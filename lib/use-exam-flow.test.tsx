// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { StoreContext, useStoreState } from "./store";
import { inMemoryProgressStore } from "./progress-store";
import { useExamFlow } from "./use-exam-flow";
import type { ExamMeta, Question } from "./types";
import type { StartOpts } from "./use-quiz";

// 퀴즈 플로 오케스트레이션 테스트 (아키텍처 리뷰 — ExamProviders God-wiring 분해). phase 머신 + 게이트
// 배선 + 라우팅이 JSX 에 용접돼 무테스트였다. 심으로 빼고 navigate 를 주입(spy)해 경로·phase 전이를 단언한다.
// 컨트롤러 내부(start/select/submit…)는 use-quiz.test 가 커버 — 여기선 플로가 그것을 게이트·라우팅과
// 엮는 배선만 본다.

const questions: Question[] = [
  { qn: 1, topic: "t", q: "", options: { A: "a", B: "b" }, answer: ["A"] },
  { qn: 2, topic: "t", q: "", options: { A: "a", B: "b" }, answer: ["B"] },
];
const byQn = new Map(questions.map((d) => [d.qn, d]));
const meta = { provider: "aws", slug: "saa" } as ExamMeta;
const base = "/aws/saa";
const OPTS: StartOpts = { topic: "all", shuffle: false, count: 2, order: "num", examMin: 0 };

// verified Learner 게이트(pass-through) — action 즉시 실행. 익명 시뮬레이션은 vi.fn()(action 미실행).
const passGate = (action: () => void) => action();

function renderFlow(requireLearner: (a: () => void) => void = passGate) {
  const navigate = vi.fn();
  const store = inMemoryProgressStore();
  const wrapper = ({ children }: { children: React.ReactNode }) => {
    const ctx = useStoreState("test/x", store, () => 1000);
    return <StoreContext.Provider value={ctx}>{children}</StoreContext.Provider>;
  };
  const hook = renderHook(
    () => useExamFlow({ questions, byQn, meta, requireLearner, navigate }),
    { wrapper },
  );
  return { ...hook, navigate };
}

describe("useExamFlow — 퀴즈 플로 오케스트레이션", () => {
  it("startMode: 게이트 통과 시 setupMode·phase(setup) + /quiz 이동", () => {
    const { result, navigate } = renderFlow();
    act(() => result.current.quizFlow.startMode("exam"));
    expect(result.current.quizFlow.setupMode).toBe("exam");
    expect(result.current.quizFlow.phase).toBe("setup");
    expect(navigate).toHaveBeenCalledWith(`${base}/quiz`);
  });

  it("게이트가 막으면(익명) startMode 는 이동·전환하지 않는다", () => {
    const blockGate = vi.fn(); // action 실행 안 함
    const { result, navigate } = renderFlow(blockGate);
    act(() => result.current.quizFlow.startMode("exam"));
    expect(blockGate).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
    expect(result.current.quizFlow.setupMode).toBe("study"); // 기본 유지
  });

  it("resume: 게이트 후 /quiz 이동", () => {
    const { result, navigate } = renderFlow();
    act(() => result.current.quizFlow.resume());
    expect(navigate).toHaveBeenCalledWith(`${base}/quiz`);
  });

  it("studyOne: 게이트 후 컨트롤러로 문항 띄우고 active + /quiz", () => {
    const { result, navigate } = renderFlow();
    act(() => result.current.nav.studyOne(2));
    expect(navigate).toHaveBeenCalledWith(`${base}/quiz`);
    expect(result.current.quizFlow.phase).toBe("active"); // goQuiz
    expect(result.current.quizFlow.quiz.current?.qn).toBe(2);
  });

  it("goHub: 게이트 없이 허브로 이동", () => {
    const { result, navigate } = renderFlow();
    act(() => result.current.quizFlow.goHub());
    expect(navigate).toHaveBeenCalledWith(base);
  });

  it("openConceptFor: 개념 라우트로(seed 인코딩)", () => {
    const { result, navigate } = renderFlow();
    act(() => result.current.nav.openConceptFor("Amazon S3"));
    expect(navigate).toHaveBeenCalledWith(`${base}/concepts?seed=Amazon%20S3`);
  });

  it("phase 전이: 시작→active, 종료→result (컨트롤러 콜백)", () => {
    const { result } = renderFlow();
    expect(result.current.quizFlow.phase).toBe("setup");
    act(() => void result.current.quizFlow.quiz.start("study", OPTS));
    expect(result.current.quizFlow.phase).toBe("active"); // goQuiz
    act(() => result.current.quizFlow.quiz.select("A", false));
    act(() => result.current.quizFlow.quiz.submit());
    act(() => result.current.quizFlow.quiz.next());
    act(() => result.current.quizFlow.quiz.select("B", false));
    act(() => result.current.quizFlow.quiz.submit());
    act(() => result.current.quizFlow.quiz.finish());
    expect(result.current.quizFlow.phase).toBe("result"); // onResult
  });

  it("quit: onHome → phase(setup) + 허브 이동", () => {
    const { result, navigate } = renderFlow();
    act(() => void result.current.quizFlow.quiz.start("study", OPTS));
    expect(result.current.quizFlow.phase).toBe("active");
    act(() => result.current.quizFlow.quiz.quit());
    expect(result.current.quizFlow.phase).toBe("setup");
    expect(navigate).toHaveBeenCalledWith(base);
  });
});
