"use client";

import { useCallback, useMemo, useState } from "react";
import type { ExamMeta, Question } from "./types";
import type { Mode } from "./store";
import { useQuizController } from "./use-quiz";
import type { QuizFlowValue, QuizPhase } from "./quiz-flow-context";
import type { NavValue } from "./nav-context";

export interface ExamFlowDeps {
  questions: Question[];
  byQn: Map<number, Question>;
  meta: ExamMeta;
  /** 연습 게이트 — usePracticeGate 에서 받는다(플로는 게이트를 소유하지 않고 주입받아 배선만 한다). */
  requireLearner: (action: () => void) => void;
  /** 라우팅 부작용 주입 — 프로덕션은 router.push, 테스트는 spy(경로 단언). */
  navigate: (path: string) => void;
}

export interface ExamFlow {
  quizFlow: QuizFlowValue;
  nav: NavValue;
}

// 퀴즈 플로 오케스트레이션 (ADR-0010 슬라이스 B2) — 퀴즈 컨트롤러 + phase 머신(setup/active/result) +
// cross-route 라우팅을 배선한다. **StoreContext 안**에서 호출해야 한다(useQuizController → useStore).
// phase 는 3상태 직접 전이라 내부 useState(순수 reducer 는 keep 못 범); 라우팅은 navigate 주입으로 테스트
// 표면이 된다. 소비: 허브(startMode/resume/discard) · /quiz(quiz/phase/setupMode/goHub) · 참조 뷰
// (studyOne/openConceptFor). 게이트(requireLearner)는 상위(usePracticeGate)에서 주입받는다.
export function useExamFlow({
  questions,
  byQn,
  meta,
  requireLearner,
  navigate,
}: ExamFlowDeps): ExamFlow {
  const base = `/${meta.provider}/${meta.slug}`;

  // 콜백은 phase 로 전환, 중단/복귀는 라우팅으로: onResult→결과, onHome(quit)→허브, goQuiz→active.
  const [phase, setPhase] = useState<QuizPhase>("setup");
  const [setupMode, setSetupMode] = useState<Mode>("study");
  const onResult = useCallback(() => setPhase("result"), []);
  const onHome = useCallback(() => {
    setPhase("setup");
    navigate(base);
  }, [navigate, base]);
  const goQuiz = useCallback(() => setPhase("active"), []);
  const quiz = useQuizController(questions, byQn, onResult, onHome, goQuiz);

  const quizFlow = useMemo<QuizFlowValue>(
    () => ({
      quiz,
      phase,
      setupMode,
      // 허브: 모드 시작 — 게이트 후 setup 단계로 /quiz 진입.
      startMode: (mode: Mode) =>
        requireLearner(() => {
          setSetupMode(mode);
          setPhase("setup");
          navigate(`${base}/quiz`);
        }),
      // 허브: 진행 중 세션 이어하기 → goQuiz(active) + /quiz.
      resume: () =>
        requireLearner(() => {
          quiz.resume();
          navigate(`${base}/quiz`);
        }),
      discard: () => quiz.discard(),
      // /quiz: 허브 복귀(setup 취소·결과 홈).
      goHub: () => navigate(base),
    }),
    [quiz, phase, setupMode, requireLearner, navigate, base],
  );

  // cross-route nav — studyOne 은 게이트 후 컨트롤러로 바로 띄우고 /quiz 로(B2), openConceptFor 는 개념 라우트로.
  const nav = useMemo<NavValue>(
    () => ({
      requireLearner,
      studyOne: (qn: number) =>
        requireLearner(() => {
          quiz.studyOne(qn);
          navigate(`${base}/quiz`);
        }),
      openConceptFor: (svc: string) =>
        navigate(`${base}/concepts?seed=${encodeURIComponent(svc)}`),
    }),
    [requireLearner, quiz, navigate, base],
  );

  return { quizFlow, nav };
}
