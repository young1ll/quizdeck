"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { LuX, LuStickyNote, LuTriangleAlert, LuHighlighter, LuUnderline, LuTrash2 } from "react-icons/lu";
import { useLang } from "@/lib/lang-context";
import { useAnnotations } from "@/lib/annotation-context";
import {
  findAnnotationAt,
  makeAnchor,
  segmentText,
  toPlainText,
  type AnnotationKind,
} from "@/lib/annotation";
import { rangeToOffsets } from "@/lib/annotation-dom";

// 주석 가능한 텍스트 (이슈 #29 / ADR-0005 D). 콘텐츠를 **평문**(마크다운 마커 제거)으로 렌더하되
// white-space:pre-wrap 으로 줄바꿈을 살린다 — 그러면 브라우저 선택 오프셋이 평문 오프셋과 1:1 이라
// quote/문맥 앵커를 정확히 만들 수 있다(마크다운 서식은 단순화 — plain-text MVP, ADR-0005 D 결정).
// 현재 표시 언어(useLang)의 주석만 보이고, 본문이 바뀌어 위치를 잃은 주석은 아래에 메모로 보존한다.

type Toolbar = { s: number; e: number; x: number; y: number };
type Editing = { id: string; x: number; y: number };

export default function AnnotatableText({
  qn,
  field,
  text,
  className = "",
}: {
  qn: number;
  field: string;
  text?: string;
  className?: string;
}) {
  const { lang } = useLang();
  const { enabled, forField, add, update, remove } = useAnnotations();
  const containerRef = useRef<HTMLSpanElement>(null);
  const [toolbar, setToolbar] = useState<Toolbar | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);

  const plain = useMemo(() => toPlainText(text), [text]);
  const anns = forField(qn, lang, field);
  const { segments, orphans } = useMemo(() => segmentText(plain, anns), [plain, anns]);

  // 바깥을 누르거나 Esc 를 누르면 툴바·편집 팝오버를 닫는다(툴바/팝오버 자체는 onMouseDown 으로
  // 전파를 막아 유지). 이 둘은 비차단 플로팅 팝오버라 모달 포커스 트랩(이슈 #49)은 적용하지 않는다
  // — Tab 으로 빠져나갈 수 있어야 하기 때문. 대신 Esc 닫기로 키보드 접근성을 맞춘다.
  useEffect(() => {
    if (!toolbar && !editing) return;
    const close = () => {
      setToolbar(null);
      setEditing(null);
    };
    const onDown = () => close();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // 닫기 전 활성 요소를 blur — 메모 textarea 의 onBlur 저장이 언마운트보다 먼저 돌게 한다.
      (document.activeElement as HTMLElement | null)?.blur?.();
      close();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [toolbar, editing]);

  // 비활성(익명)·빈 텍스트면 평문만 렌더(상호작용 없음).
  if (!enabled || !plain) {
    return <span className={`whitespace-pre-wrap ${className}`}>{plain}</span>;
  }

  function onMouseUp() {
    const sel = window.getSelection();
    const c = containerRef.current;
    if (!sel || sel.isCollapsed || sel.rangeCount === 0 || !c) return;
    const range = sel.getRangeAt(0);
    if (!c.contains(range.commonAncestorContainer)) return;
    const r = rangeToOffsets(c, range);
    if (!r) return;
    const rect = range.getBoundingClientRect();
    setEditing(null);
    setToolbar({ s: r.start, e: r.end, x: rect.left + rect.width / 2, y: rect.top });
  }

  function create(kind: AnnotationKind, withMemo: boolean) {
    const tb = toolbar;
    if (!tb) return;
    // 같은 구간에 이미 주석이 있나 — 토글/스타일전환/메모재사용을 판단(중복 누적 방지).
    const existing = findAnnotationAt(plain, anns, tb.s, tb.e);
    if (withMemo) {
      // 메모 — 같은 구간 주석이 있으면 그 메모를 열고, 없으면 형광펜으로 잡고 연다.
      const target = existing ?? add({ qn, lang, field }, kind, makeAnchor(plain, tb.s, tb.e));
      setEditing({ id: target.id, x: tb.x, y: tb.y });
    } else if (existing && existing.kind === kind) {
      remove(existing.id); // 같은 구간·같은 스타일 다시 누르면 해제(on/off 토글)
    } else if (existing) {
      update(existing.id, { kind }); // 다른 스타일로 전환
    } else {
      add({ qn, lang, field }, kind, makeAnchor(plain, tb.s, tb.e));
    }
    setToolbar(null);
    window.getSelection()?.removeAllRanges();
  }

  const editingAnn = editing ? anns.find((a) => a.id === editing.id) : undefined;

  return (
    <>
      <span
        ref={containerRef}
        className={`whitespace-pre-wrap ${className}`}
        onMouseUp={onMouseUp}
        // 선택이 있는 채로의 클릭(더블클릭 단어선택 등)이 부모 버튼(보기 선택)을 토글하지 않게.
        onClick={(ev) => {
          if (window.getSelection()?.toString()) ev.stopPropagation();
        }}
      >
        {segments.map((seg, i) => {
          if (seg.annotations.length === 0) {
            return (
              <span key={i} data-start={seg.start}>
                {seg.text}
              </span>
            );
          }
          const hasHi = seg.annotations.some((a) => a.kind === "highlight");
          const hasUl = seg.annotations.some((a) => a.kind === "underline");
          const memoAnn = seg.annotations.find((a) => a.memo);
          const target = seg.annotations[0];
          const style: CSSProperties = { cursor: "pointer" };
          if (hasHi) style.backgroundColor = "color-mix(in srgb, var(--warn) 30%, transparent)";
          if (hasUl) {
            style.textDecoration = "underline";
            style.textDecorationColor = "var(--accent)";
            style.textDecorationThickness = "2px";
            style.textUnderlineOffset = "2px";
          }
          // 편집 팝오버 열기. 텍스트 span 과 📝 마커 둘 다에서.
          const openEditor = (ev: ReactMouseEvent) => {
            ev.stopPropagation();
            const r = (ev.currentTarget as HTMLElement).getBoundingClientRect();
            setToolbar(null);
            setEditing({ id: target.id, x: r.left, y: r.bottom });
          };
          // 📝 마커는 data-start span **밖**에 user-select:none 으로 둔다 — 선택 끝점이 마커에
          // 닿아도 평문 오프셋이 어긋나지 않게(세그먼트 span = 단일 텍스트노드 불변식 유지).
          return (
            <span key={i}>
              <span
                data-start={seg.start}
                style={style}
                title={memoAnn?.memo ?? undefined}
                onClick={openEditor}
              >
                {seg.text}
              </span>
              {memoAnn && (
                <sup
                  className="ml-0.5 cursor-pointer"
                  style={{ userSelect: "none" }}
                  onClick={openEditor}
                >
                  <LuStickyNote className="inline size-2.5 text-[var(--accent)]" aria-label="메모" />
                </sup>
              )}
            </span>
          );
        })}
      </span>

      {/* 위치를 잃은 주석(본문 변경) — 메모를 보존하고 삭제만 가능 (AC: graceful orphan) */}
      {orphans.length > 0 && (
        <span className="mt-1 block rounded-md bg-[var(--panel-2)] px-2 py-1 text-xs text-[var(--muted)]">
          <LuTriangleAlert className="inline size-3.5 text-[var(--warn)] align-[-2px]" aria-hidden /> 본문이 바뀌어 위치를 잃은 메모
          {orphans.map((o) => (
            <span key={o.id} className="ml-2 inline-flex items-center gap-1">
              <span className="italic">“{o.anchor.quote}”{o.memo ? `: ${o.memo}` : ""}</span>
              <button
                type="button"
                onClick={() => remove(o.id)}
                className="text-[var(--muted)] hover:text-[var(--bad)]"
                aria-label="삭제"
                title="삭제"
              >
                <LuX className="size-3.5" aria-hidden />
              </button>
            </span>
          ))}
        </span>
      )}

      {/* 선택 툴바 — 밑줄/형광펜/메모 추가. 앵커(선택 rect) 위에 뜬다(y-44 · 가운데 정렬), 선택 유지. */}
      {toolbar && (
        <FloatingPopover
          x={toolbar.x}
          y={toolbar.y - 44}
          centered
          keepSelection
          className="flex gap-1 rounded-lg border border-[var(--border)] bg-[var(--panel)] p-1 text-xs shadow-popover"
        >
          <button type="button" onClick={() => create("highlight", false)} className="inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-[var(--panel-2)]">
            <LuHighlighter className="size-3.5" aria-hidden /> 형광펜
          </button>
          <button type="button" onClick={() => create("underline", false)} className="inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-[var(--panel-2)]">
            <LuUnderline className="size-3.5" aria-hidden /> 밑줄
          </button>
          <button type="button" onClick={() => create("highlight", true)} className="inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-[var(--panel-2)]">
            <LuStickyNote className="size-3.5" aria-hidden /> 메모
          </button>
        </FloatingPopover>
      )}

      {/* 편집 팝오버 — 스타일 전환 / 메모 / 삭제. 앵커 아래(y+4)에 뜬다. 입력 포커스는 허용(keepSelection 없음). */}
      {editing && editingAnn && (
        <FloatingPopover
          x={editing.x}
          y={editing.y + 4}
          className="w-56 rounded-lg border border-[var(--border)] bg-[var(--panel)] p-2 shadow-popover"
        >
          <div className="mb-2 flex items-center gap-1 text-xs">
            <button
              type="button"
              onClick={() => update(editingAnn.id, { kind: "highlight" })}
              className={`inline-flex items-center gap-1 rounded px-2 py-1 ${editingAnn.kind === "highlight" ? "bg-[var(--panel-2)] font-semibold" : "hover:bg-[var(--panel-2)]"}`}
            >
              <LuHighlighter className="size-3.5" aria-hidden /> 형광펜
            </button>
            <button
              type="button"
              onClick={() => update(editingAnn.id, { kind: "underline" })}
              className={`inline-flex items-center gap-1 rounded px-2 py-1 ${editingAnn.kind === "underline" ? "bg-[var(--panel-2)] font-semibold" : "hover:bg-[var(--panel-2)]"}`}
            >
              <LuUnderline className="size-3.5" aria-hidden /> 밑줄
            </button>
            <button
              type="button"
              onClick={() => {
                remove(editingAnn.id);
                setEditing(null);
              }}
              className="ml-auto flex items-center rounded px-2 py-1 text-[var(--muted)] hover:text-[var(--bad)]"
              aria-label="삭제"
              title="삭제"
            >
              <LuTrash2 className="size-3.5" aria-hidden />
            </button>
          </div>
          <textarea
            key={editingAnn.id}
            defaultValue={editingAnn.memo ?? ""}
            onBlur={(ev) => update(editingAnn.id, { memo: ev.target.value.trim() || null })}
            placeholder="메모…"
            className="h-16 w-full resize-none rounded-md border border-[var(--border)] bg-[var(--panel-2)] p-1.5 text-sm outline-none focus:border-[var(--accent)]"
          />
        </FloatingPopover>
      )}
    </>
  );
}

// 앵커(선택 rect) 좌표에 뜨는 비차단 플로팅 팝오버 — createPortal(body)로 <p> 안 div 중첩·overflow
// 클리핑을 피하고, fixed 로 좌표에 붙는다. onMouseDown 으로 바깥-클릭 닫힘(공유 dismiss effect)을 막는다.
// AnnotatableText 의 툴바·에디터가 공유하던 portal+fixed+가드 보일러플레이트를 한 곳으로. 앵커 계산·
// dismiss·주석 로직은 호출부(AnnotatableText)에 그대로 — 이건 팝오버 셸만.
function FloatingPopover({
  x,
  y,
  centered = false,
  keepSelection = false,
  className,
  children,
}: {
  x: number;
  y: number;
  centered?: boolean; // 앵커 가운데 정렬(translateX(-50%)) — 툴바
  keepSelection?: boolean; // mousedown 시 preventDefault 로 텍스트 선택 유지 — 툴바
  className?: string;
  children: ReactNode;
}) {
  const style: CSSProperties = {
    position: "fixed",
    left: x,
    top: y,
    zIndex: 50,
    ...(centered ? { transform: "translateX(-50%)" } : {}),
  };
  return createPortal(
    <div
      style={style}
      className={className}
      onMouseDown={(ev) => {
        if (keepSelection) ev.preventDefault(); // 선택 유지(툴바)
        ev.stopPropagation(); // 바깥-클릭 닫힘 방지(공유 dismiss effect)
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
