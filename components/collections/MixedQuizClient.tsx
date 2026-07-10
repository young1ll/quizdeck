"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  LuStar,
  LuStickyNote,
  LuCircleCheck,
  LuCircleX,
  LuLightbulb,
  LuX,
} from "react-icons/lu";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { TextArea } from "@astryxdesign/core/TextArea";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import Markdown from "@/components/Markdown";
import ExamIcon from "@/components/ui/ExamIcon";
import { useStoreState, type StoreCtx } from "@/lib/store";
import { localStorageProgressStore } from "@/lib/progress-store";
import { compositeProgressStore } from "@/lib/progress-store-composite";
import { remoteApiProgressStore } from "@/lib/progress-store-remote";
import { useMixedQuiz } from "@/lib/use-mixed-quiz";
import type { MixedItem } from "@/lib/mixed-session";

// 혼합 큐 컬렉션 풀기 (ADR-0022 S2 · 그릴링 확정 설계). 경량 전용 뷰(결정 B) — 문항·채점·해설·
// 진행 + 별표·메모(해당 시험 store 라우팅). 주석·개념 링크는 v1 제외(완전한 형태는 S1.5 의
// '이 시험에서 풀기'가 소유). 기존 Quiz.tsx 는 무변경.
//
// 멀티스토어 = StoreBridge 패턴: 시험당 렌더되는 브릿지가 useStoreState(기존 훅 100% 재사용,
// composite local+remote LWW)를 호출해 ctx 를 올려보낸다 — 시험 목록이 마운트 시 고정이라
// 훅 규칙과 충돌하지 않고, N개 store 로직을 새로 짓지 않는다.
export interface MixedExamMeta {
  code: string;
  icon?: string;
}

function StoreBridge({
  examKey,
  onCtx,
}: {
  examKey: string;
  onCtx: (examKey: string, ctx: StoreCtx) => void;
}) {
  // 이 라우트는 서버에서 Learner 게이트를 통과했으므로 항상 동기화 composite.
  const store = useMemo(
    () => compositeProgressStore(localStorageProgressStore(), remoteApiProgressStore()),
    [],
  );
  const ctx = useStoreState(examKey, store);
  // ctx 참조가 바뀔 때만(로드·기록) 부모에 보고 — 렌더 중 setState 금지라 effect 로.
  useEffect(() => onCtx(examKey, ctx), [examKey, ctx, onCtx]);
  return null;
}

export default function MixedQuizClient({
  collectionId,
  collectionName,
  collectionIcon,
  items,
  examMeta,
}: {
  collectionId: string;
  collectionName: string;
  collectionIcon?: string;
  items: MixedItem[];
  examMeta: Record<string, MixedExamMeta>;
}) {
  const examKeys = useMemo(() => [...new Set(items.map((i) => i.examKey))], [items]);
  const [stores, setStores] = useState<Record<string, StoreCtx>>({});
  const onCtx = useCallback((k: string, ctx: StoreCtx) => {
    setStores((prev) => (prev[k] === ctx ? prev : { ...prev, [k]: ctx }));
  }, []);
  const allLoaded = examKeys.every((k) => stores[k]?.loaded);

  return (
    <>
      {examKeys.map((k) => (
        <StoreBridge key={k} examKey={k} onCtx={onCtx} />
      ))}
      {allLoaded ? (
        <MixedQuizView
          collectionId={collectionId}
          collectionName={collectionName}
          collectionIcon={collectionIcon}
          items={items}
          examMeta={examMeta}
          stores={stores}
        />
      ) : (
        <div className="py-20 text-center text-sm text-[var(--muted)]">불러오는 중…</div>
      )}
    </>
  );
}

function MixedQuizView({
  collectionId,
  collectionName,
  collectionIcon,
  items,
  examMeta,
  stores,
}: {
  collectionId: string;
  collectionName: string;
  collectionIcon?: string;
  items: MixedItem[];
  examMeta: Record<string, MixedExamMeta>;
  stores: Record<string, StoreCtx>;
}) {
  const storeFor = useCallback((examKey: string) => stores[examKey], [stores]);
  const quiz = useMixedQuiz(items, storeFor);
  const [showMemo, setShowMemo] = useState(false);
  const [memoDraft, setMemoDraft] = useState("");

  const backHref = `/me/collections/${collectionId}`;

  // ── 결과 ───────────────────────────────────────────────
  if (quiz.phase === "result" && quiz.result) {
    const r = quiz.result;
    const summary = quiz.examSummary;
    return (
      <div className="mx-auto max-w-xl space-y-5 py-8">
        <h1 className="text-xl font-bold">
          결과 — {collectionIcon && <span>{collectionIcon} </span>}
          {collectionName}
        </h1>
        <Card padding={5}>
          <div className="text-3xl font-bold">
            {r.okCount}/{r.total} <span className="text-lg text-[var(--muted)]">({r.pct}%)</span>
          </div>
          <ul className="mt-4 space-y-1 text-sm">
            {summary.map((s) => (
              <li key={s.examKey} className="flex items-center justify-between">
                <span className="font-mono text-xs text-[var(--accent)]">
                  <ExamIcon icon={examMeta[s.examKey]?.icon} className="mr-1" />
                  {examMeta[s.examKey]?.code ?? s.examKey}
                </span>
                <span className="font-medium">{s.ok}/{s.n}</span>
              </li>
            ))}
          </ul>
        </Card>
        <div className="flex gap-2">
          {r.wrong.length > 0 && (
            <Button variant="primary" onClick={quiz.retryWrong}>
              틀린 {r.wrong.length}문항 다시 풀기
            </Button>
          )}
          <Link href={backHref}>
            <Button variant="outline">컬렉션으로</Button>
          </Link>
        </div>
      </div>
    );
  }

  const c = quiz.current;
  if (!c) return null;
  const it = items[c.qn]; // 큐 값 = 인덱스(설계 주석 참조)
  const meta = examMeta[it.examKey];
  const st = stores[it.examKey];
  const starred = st?.store.stars.includes(it.qn) ?? false;
  const memo = st?.store.memos[it.qn];
  const multi = it.question.answer.length > 1;

  return (
    <div className="mx-auto max-w-2xl space-y-4 py-6">
      {/* focus chrome — 진행 · 나가기(일회성이라 확인 없이 종료, 제출분은 이미 기록됨) */}
      <header className="flex items-center justify-between gap-3">
        <div className="text-sm text-[var(--muted)]">
          {collectionIcon && <span className="mr-1">{collectionIcon}</span>}
          {collectionName} · 진행 {c.idx + 1} / {c.total}
        </div>
        <Link
          href={backHref}
          className="flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--fg)]"
        >
          나가기 <LuX className="size-4" aria-hidden />
        </Link>
      </header>
      <ProgressBar value={c.idx + 1} max={c.total} label="진행" isLabelHidden />

      {/* 시험 배지 + 문항 번호 — 혼합 큐에서 '지금 어느 시험인지'가 1급 정보 */}
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-[var(--accent)]">
          <ExamIcon icon={meta?.icon} className="mr-1" />
          {meta?.code ?? it.examKey} · Q{it.qn}
        </span>
        <button
          type="button"
          onClick={() => st?.toggleStar(it.qn)}
          aria-label={starred ? "즐겨찾기 해제" : "즐겨찾기"}
          className="rounded p-1"
        >
          <LuStar
            className={`size-5 ${starred ? "fill-[var(--warn)] text-[var(--warn)]" : "text-[var(--muted)]"}`}
            aria-hidden
          />
        </button>
      </div>

      <Card padding={5}>
        {multi && <div className="mb-2 text-xs text-[var(--muted)]">정답 {it.question.answer.length}개</div>}
        <Markdown text={it.question.q} className="text-[15px] leading-relaxed" />
        {it.question.image && (
          <img
            src={it.question.image}
            alt="지문 이미지"
            loading="lazy"
            className="mt-3 max-w-full rounded border border-[var(--border)]"
          />
        )}
        <ul className="mt-4 space-y-2">
          {Object.entries(it.question.options).map(([k, text]) => {
            const selected = c.selected.includes(k);
            const isAnswer = it.question.answer.includes(k);
            const graded = c.isGraded;
            const border = graded
              ? isAnswer
                ? "border-green-500"
                : selected
                  ? "border-red-500"
                  : "border-[var(--border)]"
              : selected
                ? "border-[var(--accent)]"
                : "border-[var(--border)]";
            return (
              <li key={k}>
                <button
                  type="button"
                  disabled={graded}
                  onClick={() => quiz.select(k, multi)}
                  className={`flex w-full items-start gap-2 rounded-lg border ${border} bg-[var(--panel)] p-3 text-left text-sm disabled:opacity-90`}
                >
                  <span className="shrink-0 font-mono text-xs text-[var(--muted)]">{k}</span>
                  <Markdown text={text} className="min-w-0 flex-1" />
                  {graded && isAnswer && (
                    <LuCircleCheck className="size-4 shrink-0 text-green-500" aria-hidden />
                  )}
                  {graded && !isAnswer && selected && (
                    <LuCircleX className="size-4 shrink-0 text-red-500" aria-hidden />
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        {c.isGraded && (
          <div className="mt-4 space-y-3 border-t border-[var(--border)] pt-4 text-sm">
            <div className={`font-semibold ${c.isCorrect ? "text-green-500" : "text-red-500"}`}>
              {c.isCorrect ? "정답입니다" : "오답입니다"}
            </div>
            {it.question.explanation && (
              <Markdown text={it.question.explanation} className="text-[var(--fg)]" />
            )}
            {it.question.tip && (
              <div className="flex items-start gap-2 rounded-lg bg-[var(--panel)] p-3">
                <LuLightbulb className="mt-0.5 size-4 shrink-0 text-[var(--warn)]" aria-hidden />
                <Markdown text={it.question.tip} className="text-[var(--muted)]" />
              </div>
            )}
          </div>
        )}
      </Card>

      {/* 메모 — 해당 시험 Progress 로 저장(멀티스토어 라우팅) */}
      <div>
        <button
          type="button"
          onClick={() => {
            setShowMemo((v) => !v);
            setMemoDraft(memo ?? "");
          }}
          className="flex items-center gap-1 text-xs text-[var(--muted)] hover:text-[var(--fg)]"
        >
          <LuStickyNote className="size-3.5" aria-hidden /> 메모{memo ? " ●" : ""}
        </button>
        {showMemo && (
          <div className="mt-2 space-y-2">
            <TextArea
              label="메모"
              isLabelHidden
              value={memoDraft}
              onChange={(value: string) => setMemoDraft(value)}
              rows={3}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                st?.setMemo(it.qn, memoDraft);
                setShowMemo(false);
              }}
            >
              저장
            </Button>
          </div>
        )}
      </div>

      <footer className="flex items-center justify-between gap-2">
        <Button variant="outline" size="sm" onClick={quiz.prev} disabled={c.idx === 0}>
          이전
        </Button>
        {!c.isGraded ? (
          <Button variant="primary" onClick={quiz.submit} disabled={c.selected.length === 0}>
            확인
          </Button>
        ) : c.isLast ? (
          <Button variant="primary" onClick={quiz.finish}>
            결과 보기
          </Button>
        ) : (
          <Button variant="primary" onClick={quiz.next}>
            다음
          </Button>
        )}
      </footer>
    </div>
  );
}
