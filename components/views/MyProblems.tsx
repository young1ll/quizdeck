"use client";

import { useMemo, useState } from "react";
import { LuFolderOpen, LuPlay, LuStar, LuStickyNote } from "react-icons/lu";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { useExam } from "@/lib/exam-context";
import { useStore, type Mode } from "@/lib/store";
import { useQuizFlow } from "@/lib/quiz-flow-context";
import { useNav } from "@/lib/nav-context";
import { myProblems } from "@/lib/progress";
import { Button } from "@/components/ui/Button";
import AddToCollection from "@/components/collections/AddToCollection";

// 내 문제함 뷰 (ADR-0011). 오답∪별표∪메모의 파생 union 을 필터 탭으로 브라우즈하고, 묶음 풀기(세션) 또는
// 개별 학습(studyOne)으로 진입한다. 컨텍스트(store·exam·quizFlow·nav)는 exam layout 이 이미 제공한다.
type Filter = "all" | "wrong" | "star" | "memo";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "wrong", label: "틀린" },
  { key: "star", label: "별표" },
  { key: "memo", label: "메모" },
];

// 필터 → 묶음 풀기 세션 모드(ADR-0011). 각 필터가 대응 Mode 로 세션을 시작 — 전체=mine·틀린=wrong·별표=star·메모=memo.
const FILTER_MODE: Record<Filter, Mode> = {
  all: "mine",
  wrong: "wrong",
  star: "star",
  memo: "memo",
};

export default function MyProblems() {
  const { byQn, meta } = useExam();
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
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <LuFolderOpen className="size-5 text-[var(--accent)]" aria-hidden /> 내 문제함
        </h1>
        {qns.length > 0 && (
          <div className="flex items-center gap-2">
            {/* 현재 필터 묶음을 컬렉션으로 — cross-Exam 큐레이션의 담기 진입점(ADR-0022 S1.5). */}
            <AddToCollection
              items={qns.map((qn) => ({ examKey: `${meta.provider}/${meta.slug}`, qn }))}
            />
            <Button
              variant="primary"
              size="sm"
              icon={<LuPlay className="size-3.5" />}
              onClick={() => startMode(batchMode)}
            >
              이 묶음 풀기
            </Button>
          </div>
        )}
      </header>

      {/* 필터 탭 — 오답·별표·메모는 내 문제함의 축(ADR-0011). astryx SegmentedControl(단일선택 탭). */}
      <SegmentedControl
        value={filter}
        onChange={(v) => setFilter(v as Filter)}
        label="내 문제함 필터"
        size="sm"
      >
        {FILTERS.map((f) => (
          <SegmentedControlItem key={f.key} value={f.key} label={`${f.label} ${counts[f.key]}`} />
        ))}
      </SegmentedControl>

      {qns.length === 0 ? (
        <EmptyState
          isCompact
          title={
            filter === "all"
              ? "내 문제함이 비어 있습니다"
              : "해당하는 문항이 없습니다"
          }
          description={
            filter === "all"
              ? "오답·즐겨찾기·메모가 쌓이면 여기 모입니다."
              : undefined
          }
        />
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
                    {starred && (
                      <LuStar className="size-3.5 fill-[var(--warn)] text-[var(--warn)]" aria-label="즐겨찾기" />
                    )}
                    {h && h.wrong > 0 && (
                      <span className="text-xs text-[var(--bad)]">틀림 {h.wrong}회</span>
                    )}
                    {q && (
                      <span className="truncate text-xs text-[var(--muted)]">· {q.topic}</span>
                    )}
                  </div>
                  {q && <p className="mt-1 truncate text-sm">{firstLine(q.q)}</p>}
                  {memo && (
                    <p className="mt-1 flex items-center gap-1 truncate text-xs text-[var(--accent)]">
                      <LuStickyNote className="size-3 shrink-0" aria-hidden /> {memo}
                    </p>
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
