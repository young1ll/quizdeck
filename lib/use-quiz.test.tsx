// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { StoreContext, useStore, useStoreState } from "./store";
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

describe("useQuizController — exam 모드 (reducer shell)", () => {
  it("start(exam): timeLeft=limit, current.exam", () => {
    const { result } = renderController();
    act(() => void result.current.start("exam", { ...OPTS, examMin: 60 }));
    expect(result.current.current?.exam).toBe(true);
    expect(result.current.timeLeft).toBe(60 * 60); // limit 초
  });

  it("finishExam: 미응답 포함 전체 채점 → result (q1 정답·q2 미응답=오답)", () => {
    const { result, onResult } = renderController();
    act(() => void result.current.start("exam", { ...OPTS, examMin: 60 }));
    // 시험은 제출 없이 select 만 — finishExam 이 일괄 채점. q1=정답 선택, q2=미응답.
    act(() => result.current.select("A", false));
    act(() => result.current.finishExam());
    expect(onResult).toHaveBeenCalled();
    expect(result.current.result?.total).toBe(2);
    expect(result.current.result?.okCount).toBe(1);
    expect(result.current.result?.wrong.map((w) => w.qn)).toEqual([2]);
  });
});

describe("useQuizController — exam persist elapsed 회귀", () => {
  // exam 플레이 중 persist 가 store.active 에 **현재 경과를 스탬프**해야, 리로드 후 resume 이 타이머를
  // 리셋하지 않는다. 버그 전엔 persist 가 elapsed:0 그대로 저장 → resume(start=now-0)=타이머 전체 리셋.
  function renderWithActive() {
    const store = inMemoryProgressStore();
    const wrapper = ({ children }: { children: React.ReactNode }) => {
      const ctx = useStoreState("test/x", store, () => 1000);
      return <StoreContext.Provider value={ctx}>{children}</StoreContext.Provider>;
    };
    return renderHook(
      () => {
        const quiz = useQuizController(questions, byQn, vi.fn(), vi.fn(), vi.fn());
        return { quiz, active: useStore().store.active };
      },
      { wrapper },
    );
  }

  it("exam persist 가 경과를 스탬프한다(elapsed:0 리셋 버그)", () => {
    const T0 = 1_700_000_000_000;
    const now = vi.spyOn(Date, "now").mockReturnValue(T0);
    const { result } = renderWithActive();
    act(() => void result.current.quiz.start("exam", { ...OPTS, examMin: 60 }));
    now.mockReturnValue(T0 + 130_000); // 130초 경과
    act(() => result.current.quiz.select("A", false)); // persist
    expect(result.current.active?.elapsed).toBe(130); // 버그 전엔 0
    now.mockRestore();
  });
});
