// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { StoreContext, useStoreState } from "./store";
import { inMemoryProgressStore } from "./progress-store";
import { useQuizController } from "./use-quiz";
import type { Question } from "./types";
import type { StartOpts } from "./use-quiz";

// 컨트롤러 오케스트레이션 테스트 (아키텍처 리뷰). 순수 코어(gradeAnswer·computeResult·currentView,
// session.test)는 철저히 테스트됐고, 여기선 hook 이 그것들을 **엮는 lifecycle** — start→select→submit→
// next→finish→retryWrong 이 current·result 모델을 올바로 내는지 — 를 확인한다(옛날엔 use-quiz 무테스트).

const questions: Question[] = [
  { qn: 1, topic: "t", q: "", options: { A: "a", B: "b" }, answer: ["A"] },
  { qn: 2, topic: "t", q: "", options: { A: "a", B: "b" }, answer: ["B"] },
];
const byQn = new Map(questions.map((d) => [d.qn, d]));
const OPTS: StartOpts = { topic: "all", shuffle: false, count: 2, order: "num", examMin: 0 };

function renderController() {
  const cbs = { onResult: vi.fn(), onHome: vi.fn(), goQuiz: vi.fn() };
  const store = inMemoryProgressStore();
  const wrapper = ({ children }: { children: React.ReactNode }) => {
    const ctx = useStoreState("test/x", store, () => 1000);
    return <StoreContext.Provider value={ctx}>{children}</StoreContext.Provider>;
  };
  const hook = renderHook(
    () => useQuizController(questions, byQn, cbs.onResult, cbs.onHome, cbs.goQuiz),
    { wrapper },
  );
  return { ...hook, ...cbs };
}

describe("useQuizController — study 플로 오케스트레이션", () => {
  it("start→select→submit→next→finish 가 current·result 를 올바로 낸다", () => {
    const { result, onResult, goQuiz } = renderController();

    act(() => void result.current.start("study", OPTS));
    expect(goQuiz).toHaveBeenCalled();
    expect(result.current.current?.qn).toBe(1);
    expect(result.current.current?.total).toBe(2);
    expect(result.current.current?.isGraded).toBe(false);

    // q1 정답
    act(() => result.current.select("A", false));
    expect(result.current.current?.selected).toEqual(["A"]);
    act(() => result.current.submit());
    expect(result.current.current?.isGraded).toBe(true);
    expect(result.current.current?.isCorrect).toBe(true);

    // q2 오답(정답 B인데 A)
    act(() => result.current.next());
    expect(result.current.current?.qn).toBe(2);
    expect(result.current.current?.isLast).toBe(true);
    act(() => result.current.select("A", false));
    act(() => result.current.submit());
    expect(result.current.current?.isCorrect).toBe(false);

    // 결과 — 컨트롤러가 1회 계산
    act(() => result.current.finish());
    expect(onResult).toHaveBeenCalled();
    expect(result.current.result?.okCount).toBe(1);
    expect(result.current.result?.total).toBe(2);
    expect(result.current.result?.pct).toBe(50);
    expect(result.current.result?.wrong.map((w) => w.qn)).toEqual([2]);
  });

  it("retryWrong 은 결과의 오답만으로 새 세션을 연다", () => {
    const { result } = renderController();
    act(() => void result.current.start("study", OPTS));
    act(() => result.current.select("A", false)); // q1 정답
    act(() => result.current.submit());
    act(() => result.current.next());
    act(() => result.current.select("A", false)); // q2 오답
    act(() => result.current.submit());
    act(() => result.current.finish());
    expect(result.current.result?.wrong.map((w) => w.qn)).toEqual([2]);

    act(() => result.current.retryWrong());
    expect(result.current.result).not.toBeNull(); // result 는 유지
    expect(result.current.current?.total).toBe(1); // 오답 1개만
    expect(result.current.current?.qn).toBe(2);
  });
});
