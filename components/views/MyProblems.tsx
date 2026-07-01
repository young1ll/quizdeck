"use client";

import { useMemo, useState } from "react";
import { useExam } from "@/lib/exam-context";
import { useStore, type Mode } from "@/lib/store";
import { useQuizFlow } from "@/lib/quiz-flow-context";
import { useNav } from "@/lib/nav-context";
import { myProblems } from "@/lib/progress";

// 내 문제함 뷰 (ADR-0011). 오답∪별표∪메모의 파생 union 을 필터 탭으로 브라우즈하고, 묶음 풀기(세션) 또는
// 개별 학습(studyOne)으로 진입한다. 컨텍스트(store·exam·quizFlow·nav)는 exam layout 이 이미 제공한다.
type Filter = "all" | "wrong" | "star" | "memo";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "wrong", label: "틀린" },
  { key: "star", label: "별표" },
  { key: "memo", label: "메모" },
];

// 필터 → 묶음 풀기 세션 모드. 메모는 배치 모드가 없어(오답·별표만 Mode) 개별 학습만 — 배치 풀기는 후속(Slice 3).
const FILTER_MODE: Record<Filter, Mode | null> = {
  all: "mine",
  wrong: "wrong",
  star: "star",
  memo: null,
};

export default function MyProblems() {
  const { byQn } = useExam();
  const { store } = useStore();
  const { startMode } = useQuizFlow();
  const { studyOne } = useNav();
  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(
    () => ({
      all: myProblems(store).length,
      wrong: store.wrong.length,
      star: store.stars.length,
      memo: Object.keys(store.memos).length,
    }),
    [store],
  );

  const qns = useMemo(() => {
    const list =
      filter === "wrong"
        ? store.wrong
        : filter === "star"
          ? store.stars
          : filter === "memo"
            ? Object.keys(store.memos).map(Number)
            : myProblems(store);
    return [...list].sort((a, b) => a - b);
  }, [filter, store]);

  const batchMode = FILTER_MODE[filter];

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">🗂️ 내 문제함</h1>
        {batchMode && qns.length > 0 && (
          <button
            type="button"
            onClick={() => startMode(batchMode)}
            className="shrink-0 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-fg)]"
          >
            ▶ 이 묶음 풀기
          </button>
        )}
      </header>

      {/* 필터 탭 — 오답·별표·메모는 내 문제함의 축(ADR-0011) */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`min-h-[44px] rounded-lg border px-3 py-1.5 text-sm transition-colors ${
              filter === f.key
                ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_15%,transparent)]"
                : "border-[var(--border)] hover:border-[var(--accent)]"
            }`}
          >
            {f.label} {counts[f.key]}
          </button>
        ))}
      </div>

      {qns.length === 0 ? (
        <div className="rounded-panel border border-[var(--border)] bg-[var(--panel)] p-6 text-center text-sm text-[var(--muted)]">
          {filter === "all"
            ? "내 문제함이 비어 있습니다. 오답·즐겨찾기·메모가 쌓이면 여기 모입니다."
            : "해당하는 문항이 없습니다."}
        </div>
      ) : (
        <ul className="space-y-2">
          {qns.map((qn) => {
            const q = byQn.get(qn);
            const h = store.hist[qn];
            const starred = store.stars.includes(qn);
            const memo = store.memos[qn];
            return (
              <li key={qn}>
                <button
                  type="button"
                  onClick={() => studyOne(qn)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3 text-left hover:border-[var(--accent)]"
                >
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-mono text-xs text-[var(--muted)]">#{qn}</span>
                    {starred && <span title="즐겨찾기">⭐</span>}
                    {h && h.wrong > 0 && (
                      <span className="text-xs text-[var(--bad)]">틀림 {h.wrong}회</span>
                    )}
                    {q && (
                      <span className="truncate text-xs text-[var(--muted)]">· {q.topic}</span>
                    )}
                  </div>
                  {q && <p className="mt-1 truncate text-sm">{firstLine(q.q)}</p>}
                  {memo && (
                    <p className="mt-1 truncate text-xs text-[var(--accent)]">📝 {memo}</p>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// 문항 본문(마크다운)의 첫 비어있지 않은 줄 — 목록 미리보기용 라벨.
function firstLine(md: string): string {
  const line = md.split("\n").find((l) => l.trim()) ?? md;
  return line.replace(/[#*`>]/g, "").trim();
}
