"use client";

import { useMemo, useState } from "react";
import { Card } from "@astryxdesign/core/Card";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { NumberInput } from "@astryxdesign/core/NumberInput";
import { Switch } from "@astryxdesign/core/Switch";
import { Selector } from "@astryxdesign/core/Selector";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { useExam } from "@/lib/exam-context";
import { MODE_LABEL, useStore, type Mode } from "@/lib/store";
import { MODE_ICON } from "@/lib/mode-icons";
import type { StartOpts } from "@/lib/use-quiz";
import { myProblems } from "@/lib/progress";
import { Button } from "@/components/ui/Button";

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

  const ModeIcon = MODE_ICON[mode];

  return (
    <div>
      <header className="mb-5 flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <ModeIcon className="size-5 text-[var(--accent)]" aria-hidden /> {MODE_LABEL[mode]}
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
        <Card padding={6}>
          <EmptyState isCompact title={emptyHint} />
        </Card>
      ) : (
        <Card padding={5}>
          {/* astryx Button(시작)은 StyleX margin:0 → space-y 무력. 컨테이너 gap 으로 균일 배치. */}
          <div className="flex flex-col gap-4">
            {/* 주제 — astryx Selector */}
            <Selector
              label="주제"
              value={topic}
              onChange={(v) => setTopic(v ?? "all")}
              options={[{ value: "all", label: "전체 주제" }, ...topics]}
            />

            {/* 문항 수 — astryx NumberInput */}
            <NumberInput
              label="문항 수"
              value={count}
              onChange={(v) => setCount(Math.max(1, v ?? 1))}
              min={1}
              isIntegerOnly
            />

            {/* 시험 시간 */}
            {mode === "exam" && (
              <NumberInput
                label="제한 시간(분)"
                value={examMin}
                onChange={(v) => setExamMin(Math.max(1, v ?? 1))}
                min={1}
                isIntegerOnly
              />
            )}

            {/* 순서 (스마트 제외) — astryx SegmentedControl */}
            {mode !== "smart" && (
              <div>
                <span className="mb-1 block text-sm font-medium">문항 순서</span>
                <SegmentedControl
                  value={order}
                  onChange={(v) => setOrder(v as "num" | "rand")}
                  label="문항 순서"
                  size="sm"
                >
                  <SegmentedControlItem value="num" label="번호순" />
                  <SegmentedControlItem value="rand" label="무작위" />
                </SegmentedControl>
              </div>
            )}

            {/* 보기 셔플 — astryx Switch */}
            <Switch
              label="보기 순서 섞기"
              value={shuffle}
              onChange={(checked) => setShuffle(checked)}
            />

            <Button
              variant="primary"
              fullWidth
              onClick={() => {
                setPrefs({ shuffle });
                onStart({ topic, shuffle, count, order, examMin });
              }}
            >
              시작
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
