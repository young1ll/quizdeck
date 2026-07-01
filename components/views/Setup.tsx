"use client";

import { useMemo, useState } from "react";
import { useExam } from "@/lib/exam-context";
import { MODE_LABEL, useStore, type Mode } from "@/lib/store";
import type { StartOpts } from "@/lib/use-quiz";
import { myProblems } from "@/lib/progress";

const MODE_ICON: Record<Mode, string> = {
  study: "📚",
  smart: "🧠",
  exam: "⏱️",
  wrong: "🔁",
  star: "⭐",
  mine: "🗂️",
  memo: "📝",
};

export default function Setup({
  mode,
  onStart,
  onCancel,
}: {
  mode: Mode;
  onStart: (opts: StartOpts) => void;
  onCancel: () => void;
}) {
  const { topics } = useExam();
  const { store, setPrefs } = useStore();

  const mineCount = myProblems(store).length;
  const memoCount = Object.keys(store.memos).length;
  const avail =
    mode === "wrong"
      ? store.wrong.length
      : mode === "star"
        ? store.stars.length
        : mode === "mine"
          ? mineCount
          : mode === "memo"
            ? memoCount
            : Infinity; // study·smart·exam 은 전체 풀에서 뽑으므로 상한 없음

  const defaultCount =
    mode === "exam"
      ? 75
      : mode === "wrong" || mode === "star" || mode === "mine" || mode === "memo"
        ? Math.min(avail || 1, 30)
        : 20;

  const [topic, setTopic] = useState("all");
  const [order, setOrder] = useState<"num" | "rand">(
    store.prefs.shuffle ? "rand" : "num",
  );
  const [shuffle, setShuffle] = useState(store.prefs.shuffle);
  const [count, setCount] = useState(defaultCount);
  const [examMin, setExamMin] = useState(180);

  const emptyHint = useMemo(() => {
    if (mode === "wrong" && store.wrong.length === 0)
      return "오답으로 기록된 문항이 없습니다.";
    if (mode === "star" && store.stars.length === 0)
      return "즐겨찾기한 문항이 없습니다.";
    if (mode === "mine" && mineCount === 0)
      return "내 문제함이 비어 있습니다. 오답·즐겨찾기·메모가 쌓이면 여기 모입니다.";
    if (mode === "memo" && memoCount === 0) return "메모한 문항이 없습니다.";
    return "";
  }, [mode, store.wrong.length, store.stars.length, mineCount, memoCount]);

  return (
    <div>
      <header className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-bold">
          {MODE_ICON[mode]} {MODE_LABEL[mode]}
        </h1>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-[var(--muted)] hover:text-[var(--fg)]"
        >
          취소
        </button>
      </header>

      {emptyHint ? (
        <div className="rounded-panel border border-[var(--border)] bg-[var(--panel)] p-6 text-center text-sm text-[var(--muted)]">
          {emptyHint}
        </div>
      ) : (
        <div className="space-y-4 rounded-panel border border-[var(--border)] bg-[var(--panel)] p-5">
          {/* 주제 */}
          <label className="block">
            <span className="mb-1 block text-sm font-medium">주제</span>
            <select
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--panel-2)] p-2.5 text-sm outline-none focus:border-[var(--accent)]"
            >
              <option value="all">전체 주제</option>
              {topics.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          {/* 문항 수 */}
          <label className="block">
            <span className="mb-1 block text-sm font-medium">문항 수</span>
            <input
              type="number"
              min={1}
              value={count}
              onChange={(e) => setCount(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--panel-2)] p-2.5 text-sm outline-none focus:border-[var(--accent)]"
            />
          </label>

          {/* 시험 시간 */}
          {mode === "exam" && (
            <label className="block">
              <span className="mb-1 block text-sm font-medium">제한 시간(분)</span>
              <input
                type="number"
                min={1}
                value={examMin}
                onChange={(e) =>
                  setExamMin(Math.max(1, parseInt(e.target.value) || 1))
                }
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--panel-2)] p-2.5 text-sm outline-none focus:border-[var(--accent)]"
              />
            </label>
          )}

          {/* 순서 (스마트 제외) */}
          {mode !== "smart" && (
            <div>
              <span className="mb-1 block text-sm font-medium">문항 순서</span>
              <div className="flex gap-2">
                {(["num", "rand"] as const).map((o) => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => setOrder(o)}
                    className={`rounded-lg border px-4 py-2 text-sm transition-colors ${
                      order === o
                        ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_15%,transparent)]"
                        : "border-[var(--border)] hover:border-[var(--accent)]"
                    }`}
                  >
                    {o === "num" ? "번호순" : "무작위"}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 보기 셔플 */}
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={shuffle}
              onChange={(e) => setShuffle(e.target.checked)}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            보기 순서 섞기
          </label>

          <button
            type="button"
            onClick={() => {
              setPrefs({ shuffle });
              onStart({ topic, shuffle, count, order, examMin });
            }}
            className="w-full rounded-xl bg-[var(--accent)] px-5 py-3 font-semibold text-[var(--accent-fg)]"
          >
            시작
          </button>
        </div>
      )}
    </div>
  );
}
