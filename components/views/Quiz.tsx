"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  LuStar,
  LuCheck,
  LuX,
  LuCircleCheck,
  LuCircleX,
  LuLightbulb,
  LuBookOpen,
  LuFileText,
  LuFlag,
  LuLayoutGrid,
  LuStickyNote,
} from "react-icons/lu";
import { Card } from "@astryxdesign/core/Card";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { TextArea } from "@astryxdesign/core/TextArea";
import { useExam } from "@/lib/exam-context";
import { useNav } from "@/lib/nav-context";
import { useStore } from "@/lib/store";
import { setsEqual, shuffle } from "@/lib/session";
import type { QuizController } from "@/lib/use-quiz";
import Icon from "@/components/Icon";
import AnnotatableText from "@/components/AnnotatableText";
import { Button } from "@/components/ui/Button";

export default function Quiz({ quiz }: { quiz: QuizController }) {
  const { byQn, q2svc } = useExam();
  const { store, toggleStar, setMemo } = useStore();
  const { openConceptFor } = useNav();
  const s = quiz.session;

  const [showNav, setShowNav] = useState(false);
  const [showMemo, setShowMemo] = useState(false);
  const [memoDraft, setMemoDraft] = useState("");
  const orderCache = useRef<Map<number, string[]>>(new Map());

  const qn = s ? s.queue[s.idx] : -1;
  const d = qn >= 0 ? byQn.get(qn) : undefined;

  // 보기 표시 순서(셔플 시 qn별 1회 캐시)
  const optOrder = useMemo(() => {
    if (!d) return [];
    const keys = Object.keys(d.options).sort();
    if (!store.prefs.shuffle) return keys;
    const cached = orderCache.current.get(qn);
    if (cached) return cached;
    const sh = shuffle(keys);
    orderCache.current.set(qn, sh);
    return sh;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qn, d, store.prefs.shuffle]);

  // 메모 동기화
  useEffect(() => {
    setMemoDraft(qn >= 0 ? store.memos[qn] ?? "" : "");
    setShowMemo(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qn]);

  // 키보드 단축키
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const cur = quiz.session;
      if (!cur) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT") return;
      const cqn = cur.queue[cur.idx];
      const cd = byQn.get(cqn);
      if (!cd) return;
      const k = e.key.toUpperCase();
      const graded = !cur.exam && cur.answers[cqn]?.ok !== undefined;
      if (/^[A-F]$/.test(k) && cd.options[k]) {
        if (!graded) quiz.select(k, cd.answer.length > 1);
        e.preventDefault();
        return;
      }
      if (e.key === "Enter") {
        if (!cur.exam && !graded) quiz.submit();
        else if (cur.exam && cur.idx === cur.queue.length - 1) quiz.finishExam();
        else quiz.next();
        e.preventDefault();
      }
      if (e.key === "ArrowRight") quiz.next();
      if (e.key === "ArrowLeft") quiz.prev();
      if (k === "S") toggleStar(cqn);
      if (k === "F" && cur.exam) quiz.toggleFlag();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [quiz, byQn, toggleStar]);

  if (!s || !d) return null;

  const sel = s.answers[qn]?.sel ?? [];
  const graded = !s.exam && s.answers[qn]?.ok !== undefined;
  const multi = d.answer.length > 1;
  const isLast = s.idx === s.queue.length - 1;
  const starred = store.stars.includes(qn);
  const flagged = s.flags.includes(qn);
  const ok = graded ? setsEqual(sel, d.answer) : false;
  const rel = q2svc[String(qn)] ?? [];

  // 진행(n/N)·타이머·나가기는 sticky 맥락 헤더의 focus chrome 으로 승격됨(ExamHeaderBinder, ADR-0012
  // 결정 9) — 여기선 Q번호·주제·별표만. 스크롤 중에도 진행·타이머가 헤더에 상시 보인다.
  return (
    <div>
      {/* 헤더 */}
      <div className="mb-3 flex items-center justify-between gap-2 text-sm">
        <span className="font-mono text-[var(--muted)]">Q{qn}</span>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[var(--panel-2)] px-3 py-1 text-xs">
            {d.topic}
          </span>
          <button
            type="button"
            onClick={() => toggleStar(qn)}
            title="즐겨찾기 (S)"
            aria-label="즐겨찾기"
            className={`leading-none ${starred ? "text-[var(--warn)]" : "text-[var(--muted)]"}`}
          >
            <LuStar className={`size-5 ${starred ? "fill-[var(--warn)]" : ""}`} aria-hidden />
          </button>
        </div>
      </div>
      <div className="mb-5">
        <ProgressBar
          value={s.idx + 1}
          max={s.queue.length}
          label="퀴즈 진행"
          isLabelHidden
          variant="accent"
        />
      </div>

      {/* 문항 카드 — astryx Card. 채점 옵션 버튼·피드백은 도메인 상태(정답/오답 색)라 유지. */}
      <Card padding={5}>
        <div className="mb-2 flex items-center gap-2 text-xs text-[var(--muted)]">
          <span>{multi ? `정답 ${d.answer.length}개 선택` : "정답 1개"}</span>
        </div>
        <p className="leading-relaxed">
          <AnnotatableText qn={qn} field="q" text={d.q} />
        </p>

        <ul className="mt-5 space-y-2">
          {optOrder.map((letter) => {
            const chosen = sel.includes(letter);
            const isAns = d.answer.includes(letter);
            let cls =
              "border-[var(--border)] bg-[var(--panel-2)] hover:border-[var(--accent)]";
            let mark: React.ReactNode = null;
            if (graded) {
              if (isAns) {
                cls = "border-[var(--good)] bg-[color-mix(in_srgb,var(--good)_15%,transparent)]";
                mark = (
                  <>
                    <LuCheck className="size-3.5 text-[var(--good)]" aria-hidden />
                    {chosen ? "내 선택" : "정답"}
                  </>
                );
              } else if (chosen) {
                cls = "border-[var(--bad)] bg-[color-mix(in_srgb,var(--bad)_15%,transparent)]";
                mark = (
                  <>
                    <LuX className="size-3.5 text-[var(--bad)]" aria-hidden />
                    내 선택
                  </>
                );
              } else {
                cls = "border-[var(--border)] bg-[var(--panel-2)] opacity-70";
              }
            } else if (chosen) {
              cls = "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_15%,transparent)]";
            }
            return (
              <li key={letter}>
                <button
                  type="button"
                  onClick={() => quiz.select(letter, multi)}
                  disabled={graded}
                  className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors ${cls}`}
                >
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[var(--border)] font-mono text-xs">
                    {letter}
                  </span>
                  <span className="flex-1 leading-snug">
                    <AnnotatableText qn={qn} field={`opt:${letter}`} text={d.options[letter]} />
                  </span>
                  {mark && (
                    <span className="flex shrink-0 items-center gap-1 text-xs text-[var(--muted)]">
                      {mark}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        {/* 피드백 (비시험, 채점 후) */}
        {graded && (
          <div className="mt-5 space-y-3 border-t border-[var(--border)] pt-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span
                className={`inline-flex items-center gap-1 ${ok ? "text-[var(--good)]" : "text-[var(--bad)]"}`}
              >
                {ok ? (
                  <>
                    <LuCircleCheck className="size-4" aria-hidden /> 정답!
                  </>
                ) : (
                  <>
                    <LuCircleX className="size-4" aria-hidden /> 오답
                  </>
                )}
              </span>
              <span className="text-[var(--muted)]">
                · 정답 {d.answer.join(", ")} · 내 선택 {sel.join(", ") || "-"}
              </span>
            </div>
            {d.explanation && (
              <p className="text-sm leading-relaxed">
                <b className="text-[var(--accent)]">해설</b>{" "}
                <AnnotatableText qn={qn} field="explanation" text={d.explanation} />
              </p>
            )}
            {d.tip && (
              <p className="rounded-lg bg-[var(--panel-2)] p-3 text-sm leading-relaxed text-[var(--muted)]">
                <b className="inline-flex items-center gap-1">
                  <LuLightbulb className="size-4" aria-hidden /> 풀이 팁
                </b>{" "}
                <AnnotatableText qn={qn} field="tip" text={d.tip} />
              </p>
            )}
            {rel.length > 0 && (
              <div className="text-sm">
                <b className="inline-flex items-center gap-1 text-[var(--accent)]">
                  <LuBookOpen className="size-4" aria-hidden /> 관련 핵심 서비스 개념
                </b>
                <div className="mt-2 flex flex-wrap gap-2">
                  {rel.map((svc) => (
                    <button
                      key={svc}
                      type="button"
                      onClick={() => openConceptFor(svc)}
                      className="flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--panel-2)] px-2.5 py-1 text-xs hover:border-[var(--accent)]"
                    >
                      <Icon svc={svc} size={16} />
                      {svc}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {d.page != null && (
              <div className="flex items-center gap-1 text-xs text-[var(--muted)]">
                <LuFileText className="size-3.5" aria-hidden /> 원문 p{d.page}</div>
            )}
          </div>
        )}

        {/* 메모 — astryx TextArea(라벨 숨김) */}
        {showMemo && (
          <div className="mt-4 border-t border-[var(--border)] pt-3">
            <TextArea
              label="문항 메모"
              isLabelHidden
              value={memoDraft}
              onChange={(v) => setMemoDraft(v)}
              onBlur={() => setMemo(qn, memoDraft)}
              placeholder="이 문항에 대한 메모…"
              rows={3}
            />
          </div>
        )}
      </Card>

      {/* 시험 모드: 검토 표시 + 네비 토글 */}
      {s.exam && (
        <div className="mt-3 flex items-center gap-2 text-sm">
          <Button
            variant="outline"
            size="sm"
            icon={<LuFlag className={`size-3.5 ${flagged ? "fill-[var(--warn)] text-[var(--warn)]" : ""}`} />}
            onClick={quiz.toggleFlag}
          >
            {flagged ? "표시됨" : "검토 표시"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            icon={<LuLayoutGrid className="size-3.5" />}
            onClick={() => setShowNav((v) => !v)}
          >
            문항 네비
          </Button>
        </div>
      )}
      {s.exam && showNav && (
        <div className="mt-3 grid grid-cols-8 gap-1.5 sm:grid-cols-10">
          {s.queue.map((cqn, i) => {
            const done = !!s.answers[cqn]?.sel?.length;
            const fl = s.flags.includes(cqn);
            const cur = i === s.idx;
            return (
              <button
                key={cqn}
                type="button"
                onClick={() => quiz.navTo(i)}
                className={`aspect-square rounded-md border text-xs ${
                  cur
                    ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                    : fl
                      ? "border-[var(--warn)] text-[var(--warn)]"
                      : done
                        ? "border-[var(--good)] text-[var(--good)]"
                        : "border-[var(--border)] text-[var(--muted)]"
                }`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      )}

      {/* 하단 액션 */}
      <div className="mt-5 flex items-center justify-between gap-3">
        <div className="flex gap-3 text-sm text-[var(--muted)]">
          {/* 종료(나가기)는 sticky 헤더 focus chrome 으로 이동(ADR-0012 결정 9). 여기선 메모만. */}
          <button
            type="button"
            onClick={() => setShowMemo((v) => !v)}
            className="inline-flex items-center gap-1 hover:text-[var(--fg)]"
          >
            <LuStickyNote className="size-4" aria-hidden /> 메모
          </button>
        </div>

        <div className="flex gap-2">
          {s.idx > 0 && (
            <Button variant="outline" onClick={quiz.prev}>
              이전
            </Button>
          )}
          {s.exam ? (
            isLast ? (
              <Button variant="primary" onClick={quiz.finishExam}>
                제출·채점
              </Button>
            ) : (
              <Button variant="primary" onClick={quiz.next}>
                다음
              </Button>
            )
          ) : !graded ? (
            <Button variant="primary" onClick={quiz.submit} disabled={sel.length === 0}>
              확인
            </Button>
          ) : isLast ? (
            <Button variant="primary" onClick={quiz.finish}>
              결과 보기
            </Button>
          ) : (
            <Button variant="primary" onClick={quiz.next}>
              다음
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
