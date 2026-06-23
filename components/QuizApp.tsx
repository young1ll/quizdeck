"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ExamMeta, Question } from "@/lib/types";
import { renderMarkdown } from "@/lib/md";

type Phase = "setup" | "quiz" | "result";

interface SavedSession {
  pool: number[]; // 이번 회차 문항 번호 순서
  idx: number; // 현재 위치
  selections: Record<number, string[]>; // qn -> 선택 글자들
  submitted: number[]; // 확인 완료된 qn
  createdAt: number;
}

const STORAGE_PREFIX = "quizdeck:v1:";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function setsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sb = new Set(b);
  return a.every((x) => sb.has(x));
}

export default function QuizApp({
  meta,
  questions,
}: {
  meta: ExamMeta;
  questions: Question[];
}) {
  const storageKey = `${STORAGE_PREFIX}${meta.provider}/${meta.slug}`;
  const byQn = useMemo(() => {
    const m = new Map<number, Question>();
    for (const q of questions) m.set(q.qn, q);
    return m;
  }, [questions]);

  const [phase, setPhase] = useState<Phase>("setup");
  const [pool, setPool] = useState<number[]>([]);
  const [idx, setIdx] = useState(0);
  const [selections, setSelections] = useState<Record<number, string[]>>({});
  const [submitted, setSubmitted] = useState<Set<number>>(new Set());
  const [resumeAvailable, setResumeAvailable] = useState<SavedSession | null>(
    null,
  );

  // 마운트 시 저장 세션 확인(클라이언트 전용)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const s = JSON.parse(raw) as SavedSession;
        if (s.pool?.length && s.idx < s.pool.length) setResumeAvailable(s);
      }
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  // 진행 중 세션 영속화
  const persist = useCallback(
    (next: Partial<SavedSession>) => {
      try {
        const cur: SavedSession = {
          pool,
          idx,
          selections,
          submitted: [...submitted],
          createdAt: Date.now(),
          ...next,
        };
        localStorage.setItem(storageKey, JSON.stringify(cur));
      } catch {
        /* ignore */
      }
    },
    [pool, idx, selections, submitted, storageKey],
  );

  const clearSaved = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  // ── 세션 시작 ───────────────────────────────────────────────
  const startSession = useCallback(
    (qns: number[], doShuffle: boolean) => {
      const ordered = doShuffle ? shuffle(qns) : [...qns];
      setPool(ordered);
      setIdx(0);
      setSelections({});
      setSubmitted(new Set());
      setPhase("quiz");
      setResumeAvailable(null);
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            pool: ordered,
            idx: 0,
            selections: {},
            submitted: [],
            createdAt: Date.now(),
          } satisfies SavedSession),
        );
      } catch {
        /* ignore */
      }
    },
    [storageKey],
  );

  const resume = useCallback(() => {
    const s = resumeAvailable;
    if (!s) return;
    setPool(s.pool);
    setIdx(s.idx);
    setSelections(s.selections ?? {});
    setSubmitted(new Set(s.submitted ?? []));
    setPhase("quiz");
    setResumeAvailable(null);
  }, [resumeAvailable]);

  // ── 결과 집계 ───────────────────────────────────────────────
  const graded = useMemo(() => {
    const rows = pool.map((qn) => {
      const q = byQn.get(qn)!;
      const sel = selections[qn] ?? [];
      const correct = setsEqual(sel, q.answer);
      return { qn, topic: q.topic, sel, answer: q.answer, correct };
    });
    const answered = rows.filter((r) => submitted.has(r.qn));
    const correctCount = answered.filter((r) => r.correct).length;
    return { rows, answered, correctCount };
  }, [pool, byQn, selections, submitted]);

  // ── 렌더: 설정 화면 ─────────────────────────────────────────
  if (phase === "setup") {
    return (
      <SetupScreen
        meta={meta}
        total={questions.length}
        resume={resumeAvailable}
        onResume={resume}
        onStart={(count, doShuffle) => {
          const all = questions.map((q) => q.qn);
          const picked = doShuffle
            ? shuffle(all).slice(0, count)
            : all.slice(0, count);
          startSession(picked, doShuffle);
        }}
        onDiscardSaved={() => {
          clearSaved();
          setResumeAvailable(null);
        }}
      />
    );
  }

  // ── 렌더: 결과 화면 ─────────────────────────────────────────
  if (phase === "result") {
    const wrong = graded.answered.filter((r) => !r.correct);
    const pct =
      graded.answered.length === 0
        ? 0
        : Math.round((graded.correctCount / graded.answered.length) * 100);
    return (
      <ResultScreen
        meta={meta}
        total={graded.answered.length}
        correct={graded.correctCount}
        pct={pct}
        wrong={wrong}
        onRetryWrong={() => {
          if (wrong.length === 0) return;
          startSession(
            wrong.map((w) => w.qn),
            false,
          );
        }}
        onRestart={() => {
          clearSaved();
          setPhase("setup");
        }}
      />
    );
  }

  // ── 렌더: 풀이 화면 ─────────────────────────────────────────
  const qn = pool[idx];
  const q = byQn.get(qn)!;
  const sel = selections[qn] ?? [];
  const isSubmitted = submitted.has(qn);
  const need = q.answer.length;
  const optKeys = Object.keys(q.options).sort();
  const isLast = idx === pool.length - 1;

  const toggle = (letter: string) => {
    if (isSubmitted) return;
    setSelections((prev) => {
      const cur = prev[qn] ?? [];
      const nextSel = cur.includes(letter)
        ? cur.filter((x) => x !== letter)
        : [...cur, letter];
      const next = { ...prev, [qn]: nextSel };
      persist({ selections: next });
      return next;
    });
  };

  const confirm = () => {
    const next = new Set(submitted);
    next.add(qn);
    setSubmitted(next);
    persist({ submitted: [...next] });
  };

  const go = (nextIdx: number) => {
    setIdx(nextIdx);
    persist({ idx: nextIdx });
  };

  return (
    <div>
      {/* 진행 헤더 */}
      <div className="mb-4 flex items-center justify-between text-sm">
        <span className="font-mono text-[var(--muted)]">
          {idx + 1} / {pool.length}
        </span>
        <span className="rounded-full bg-[var(--panel-2)] px-3 py-1 text-xs">
          {q.topic}
        </span>
      </div>
      <div className="mb-5 h-1 w-full overflow-hidden rounded-full bg-[var(--panel-2)]">
        <div
          className="h-full bg-[var(--accent)] transition-all"
          style={{ width: `${((idx + 1) / pool.length) * 100}%` }}
        />
      </div>

      {/* 문항 카드 */}
      <article className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5">
        <div className="mb-2 flex items-center gap-2 text-xs text-[var(--muted)]">
          <span className="font-mono">Q{q.qn}</span>
          <span>· {need === 1 ? "정답 1개" : `정답 ${need}개 선택`}</span>
        </div>
        <p
          className="md leading-relaxed"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(q.q) }}
        />

        <ul className="mt-5 space-y-2">
          {optKeys.map((letter) => {
            const chosen = sel.includes(letter);
            const isAnswer = q.answer.includes(letter);
            let cls =
              "border-[var(--border)] bg-[var(--panel-2)] hover:border-[var(--accent)]";
            if (isSubmitted) {
              if (isAnswer)
                cls = "border-[var(--good)] bg-[color-mix(in_srgb,var(--good)_15%,transparent)]";
              else if (chosen)
                cls = "border-[var(--bad)] bg-[color-mix(in_srgb,var(--bad)_15%,transparent)]";
              else cls = "border-[var(--border)] bg-[var(--panel-2)] opacity-70";
            } else if (chosen) {
              cls = "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_15%,transparent)]";
            }
            return (
              <li key={letter}>
                <button
                  type="button"
                  onClick={() => toggle(letter)}
                  disabled={isSubmitted}
                  className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors ${cls}`}
                >
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[var(--border)] font-mono text-xs">
                    {letter}
                  </span>
                  <span className="leading-snug">{q.options[letter]}</span>
                </button>
              </li>
            );
          })}
        </ul>

        {/* 해설 */}
        {isSubmitted && (
          <div className="mt-5 space-y-3 border-t border-[var(--border)] pt-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              {setsEqual(sel, q.answer) ? (
                <span className="text-[var(--good)]">정답</span>
              ) : (
                <span className="text-[var(--bad)]">오답</span>
              )}
              <span className="text-[var(--muted)]">
                · 정답: {q.answer.join(", ")}
              </span>
            </div>
            {q.explanation && (
              <p
                className="md text-sm leading-relaxed text-[var(--fg)]/90"
                dangerouslySetInnerHTML={{
                  __html: renderMarkdown(q.explanation),
                }}
              />
            )}
            {q.tip && (
              <p
                className="md rounded-lg bg-[var(--panel-2)] p-3 text-sm leading-relaxed text-[var(--muted)]"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(q.tip) }}
              />
            )}
          </div>
        )}
      </article>

      {/* 하단 액션 */}
      <div className="mt-5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setPhase("result")}
          className="text-sm text-[var(--muted)] hover:text-[var(--fg)]"
        >
          종료
        </button>

        <div className="flex gap-2">
          {idx > 0 && (
            <button
              type="button"
              onClick={() => go(idx - 1)}
              className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm hover:border-[var(--accent)]"
            >
              이전
            </button>
          )}
          {!isSubmitted ? (
            <button
              type="button"
              onClick={confirm}
              disabled={sel.length === 0}
              className="rounded-xl bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-[var(--accent-fg)] disabled:opacity-40"
            >
              확인
            </button>
          ) : isLast ? (
            <button
              type="button"
              onClick={() => setPhase("result")}
              className="rounded-xl bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-[var(--accent-fg)]"
            >
              결과 보기
            </button>
          ) : (
            <button
              type="button"
              onClick={() => go(idx + 1)}
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

// ── 설정 화면 ─────────────────────────────────────────────────
function SetupScreen({
  meta,
  total,
  resume,
  onResume,
  onStart,
  onDiscardSaved,
}: {
  meta: ExamMeta;
  total: number;
  resume: SavedSession | null;
  onResume: () => void;
  onStart: (count: number, shuffle: boolean) => void;
  onDiscardSaved: () => void;
}) {
  const presets = useMemo(() => {
    const base = [10, 20, 40].filter((n) => n < total);
    return [...base, total];
  }, [total]);

  const [count, setCount] = useState<number>(presets[0] ?? total);
  const [doShuffle, setDoShuffle] = useState(true);

  return (
    <div>
      <header className="mb-6">
        <div className="font-mono text-xs text-[var(--accent)]">
          {meta.code}
        </div>
        <h1 className="mt-1 text-2xl font-bold leading-snug">{meta.name}</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">전체 {total}문항</p>
      </header>

      {resume && (
        <div className="mb-6 rounded-xl border border-[var(--warn)]/40 bg-[var(--panel)] p-4">
          <p className="text-sm">
            진행 중인 세션이 있습니다 ({resume.idx + 1}/{resume.pool.length}).
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={onResume}
              className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-fg)]"
            >
              이어서 풀기
            </button>
            <button
              type="button"
              onClick={onDiscardSaved}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm hover:border-[var(--bad)]"
            >
              새로 시작
            </button>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5">
        <div className="mb-4">
          <div className="mb-2 text-sm font-medium">문항 수</div>
          <div className="flex flex-wrap gap-2">
            {presets.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setCount(n)}
                className={`rounded-lg border px-4 py-2 text-sm transition-colors ${
                  count === n
                    ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_15%,transparent)]"
                    : "border-[var(--border)] hover:border-[var(--accent)]"
                }`}
              >
                {n === total ? `전체 ${n}` : n}
              </button>
            ))}
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={doShuffle}
            onChange={(e) => setDoShuffle(e.target.checked)}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          문항 순서 섞기
        </label>

        <button
          type="button"
          onClick={() => onStart(count, doShuffle)}
          className="mt-5 w-full rounded-xl bg-[var(--accent)] px-5 py-3 font-semibold text-[var(--accent-fg)]"
        >
          시작
        </button>
      </div>
    </div>
  );
}

// ── 결과 화면 ─────────────────────────────────────────────────
function ResultScreen({
  meta,
  total,
  correct,
  pct,
  wrong,
  onRetryWrong,
  onRestart,
}: {
  meta: ExamMeta;
  total: number;
  correct: number;
  pct: number;
  wrong: { qn: number; topic: string }[];
  onRetryWrong: () => void;
  onRestart: () => void;
}) {
  return (
    <div>
      <header className="mb-6">
        <div className="font-mono text-xs text-[var(--accent)]">
          {meta.code} · 결과
        </div>
      </header>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-6 text-center">
        <div className="text-5xl font-bold">{pct}%</div>
        <div className="mt-2 text-[var(--muted)]">
          {total}문항 중 {correct}개 정답
        </div>
      </div>

      {wrong.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-[var(--muted)]">
            틀린 문항 {wrong.length}개
          </h2>
          <ul className="space-y-1">
            {wrong.map((w) => (
              <li
                key={w.qn}
                className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm"
              >
                <span className="font-mono text-[var(--muted)]">Q{w.qn}</span>
                <span>{w.topic}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-6 flex gap-2">
        {wrong.length > 0 && (
          <button
            type="button"
            onClick={onRetryWrong}
            className="flex-1 rounded-xl bg-[var(--accent)] px-5 py-3 font-semibold text-[var(--accent-fg)]"
          >
            틀린 문제 다시
          </button>
        )}
        <button
          type="button"
          onClick={onRestart}
          className="flex-1 rounded-xl border border-[var(--border)] px-5 py-3 font-semibold hover:border-[var(--accent)]"
        >
          처음으로
        </button>
      </div>
    </div>
  );
}
