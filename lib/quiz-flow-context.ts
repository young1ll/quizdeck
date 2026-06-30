"use client";

import { createContext, useContext } from "react";
import type { Mode } from "./store";
import type { QuizController } from "./use-quiz";

// 퀴즈 플로 (ADR-0010 슬라이스 B2). 퀴즈 컨트롤러·phase 를 exam layout(ExamProviders)으로 올려
// 라우트를 가로질러 유지하고 /quiz 라우트가 phase 로 렌더한다. 허브(index)는 시작/이어하기/버리기를,
// /quiz 는 quiz·phase·setupMode·허브복귀를 소비한다.
export type QuizPhase = "setup" | "active" | "result";

export interface QuizFlowValue {
  quiz: QuizController;
  phase: QuizPhase;
  setupMode: Mode;
  /** 허브: 모드 시작 — 연습 게이트 후 setup 단계로 /quiz 진입. */
  startMode: (mode: Mode) => void;
  /** 허브: 진행 중 세션 이어하기 → /quiz active. */
  resume: () => void;
  /** 허브: 진행 중 세션 버리기. */
  discard: () => void;
  /** /quiz: 허브로 복귀(setup 취소·결과 홈·퀴즈 중단). */
  goHub: () => void;
}

export const QuizFlowContext = createContext<QuizFlowValue | null>(null);

export function useQuizFlow(): QuizFlowValue {
  const c = useContext(QuizFlowContext);
  if (!c) throw new Error("useQuizFlow must be used within QuizFlowContext.Provider");
  return c;
}
