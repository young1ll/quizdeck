"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useExam } from "@/lib/exam-context";
import { useNav } from "@/lib/nav-context";
import { useStore } from "@/lib/store";
import { setsEqual, shuffle } from "@/lib/session";
import type { QuizController } from "@/lib/use-quiz";
import Icon from "@/components/Icon";
import AnnotatableText from "@/components/AnnotatableText";

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

  const fmtTime = (sec: number) =>
    `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

  return (
    <div>
      {/* 헤더 */}
      <div className="mb-3 flex items-center justify-between gap-2 text-sm">
        <span className="font-mono text-[var(--muted)]">
          {s.idx + 1} / {s.queue.length} · Q{qn}
        </span>
        <div className="flex items-center gap-2">
          {s.exam && quiz.timeLeft !== null && (
            <span
              className={`rounded-md px-2 py-1 font-mono text-xs ${
                quiz.timeLeft < 300
                  ? "bg-[var(--bad)] text-white"
                  : "bg-[var(--panel-2)]"
              }`}
            >
              ⏱ {fmtTime(Math.max(0, quiz.timeLeft))}
            </span>
          )}
          <span className="rounded-full bg-[var(--panel-2)] px-3 py-1 text-xs">
            {d.topic}
          </span>
          <button
            type="button"
            onClick={() => toggleStar(qn)}
            title="즐겨찾기 (S)"
            className={`text-lg leading-none ${starred ? "text-[var(--warn)]" : "text-[var(--muted)]"}`}
          >
            {starred ? "★" : "☆"}
          </button>
        </div>
      </div>
      <div className="mb-5 h-1 w-full overflow-hidden rounded-full bg-[var(--panel-2)]">
        <div
          className="h-full bg-[var(--accent)] transition-all"
          style={{ width: `${((s.idx + 1) / s.queue.length) * 100}%` }}
        />
      </div>

      {/* 문항 카드 */}
      <article className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5">
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
            let mark = "";
            if (graded) {
              if (isAns) {
                cls = "border-[var(--good)] bg-[color-mix(in_srgb,var(--good)_15%,transparent)]";
                mark = chosen ? "✓ 내 선택" : "✓ 정답";
              } else if (chosen) {
                cls = "border-[var(--bad)] bg-[color-mix(in_srgb,var(--bad)_15%,transparent)]";
                mark = "✗ 내 선택";
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
                    <span className="shrink-0 text-xs text-[var(--muted)]">{mark}</span>
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
              <span className={ok ? "text-[var(--good)]" : "text-[var(--bad)]"}>
                {ok ? "✅ 정답!" : "❌ 오답"}
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
                <b>💡 풀이 팁</b> <AnnotatableText qn={qn} field="tip" text={d.tip} />
              </p>
            )}
            {rel.length > 0 && (
              <div className="text-sm">
                <b className="text-[var(--accent)]">📚 관련 핵심 서비스 개념</b>
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
              <div className="text-xs text-[var(--muted)]">📄 원문 p{d.page}</div>
            )}
          </div>
        )}

        {/* 메모 */}
        {showMemo && (
          <div className="mt-4 border-t border-[var(--border)] pt-3">
            <textarea
              value={memoDraft}
              onChange={(e) => setMemoDraft(e.target.value)}
              onBlur={() => setMemo(qn, memoDraft)}
              placeholder="이 문항에 대한 메모…"
              className="h-20 w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--panel-2)] p-2 text-sm outline-none focus:border-[var(--accent)]"
            />
          </div>
        )}
      </article>

      {/* 시험 모드: 검토 표시 + 네비 토글 */}
      {s.exam && (
        <div className="mt-3 flex items-center gap-2 text-sm">
          <button
            type="button"
            onClick={quiz.toggleFlag}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 hover:border-[var(--warn)]"
          >
            {flagged ? "🚩 표시됨" : "🚩 검토 표시"}
          </button>
          <button
            type="button"
            onClick={() => setShowNav((v) => !v)}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 hover:border-[var(--accent)]"
          >
            🧭 문항 네비
          </button>
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
          <button type="button" onClick={quiz.quit} className="hover:text-[var(--fg)]">
            종료
          </button>
          <button
            type="button"
            onClick={() => setShowMemo((v) => !v)}
            className="hover:text-[var(--fg)]"
          >
            📝 메모
          </button>
        </div>

        <div className="flex gap-2">
          {s.idx > 0 && (
            <button
              type="button"
              onClick={quiz.prev}
              className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm hover:border-[var(--accent)]"
            >
              이전
            </button>
          )}
          {s.exam ? (
            isLast ? (
              <button
                type="button"
                onClick={quiz.finishExam}
                className="rounded-xl bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-[var(--accent-fg)]"
              >
                제출·채점
              </button>
            ) : (
              <button
                type="button"
                onClick={quiz.next}
                className="rounded-xl bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-[var(--accent-fg)]"
              >
                다음
              </button>
            )
          ) : !graded ? (
            <button
              type="button"
              onClick={quiz.submit}
              disabled={sel.length === 0}
              className="rounded-xl bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-[var(--accent-fg)] disabled:opacity-40"
            >
              확인
            </button>
          ) : isLast ? (
            <button
              type="button"
              onClick={quiz.finish}
              className="rounded-xl bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-[var(--accent-fg)]"
            >
              결과 보기
            </button>
          ) : (
            <button
              type="button"
              onClick={quiz.next}
              className="rounded-xl bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-[var(--accent-fg)]"
            >
              다음
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
