"use client";

import { createContext, useContext } from "react";

// exam 내 cross-route 액션 (ADR-0010 슬라이스 B). 참조 뷰(concept·diagram·map·search·history)는
// 라우트가 되고 hub-and-spoke 로 오간다 — 뷰 전환(go/view)·conceptSeed 는 라우팅·query 로 대체됐다.
// 여기 남는 건 라우트를 가로지르는 액션과 연습 게이트뿐:
//  - requireLearner: 연습 게이트(익명이면 로그인 모달). 참조 뷰의 studyOne 이 쓴다.
//  - studyOne: 한 문항 학습 — 게이트 후 퀴즈 컨트롤러로 바로 띄우고 /quiz 로 이동(슬라이스 B2 —
//    컨트롤러가 layout 으로 올라가 직접 호출 가능, studyIntent 우회 제거).
//  - openConceptFor: 서비스명으로 개념 라우트로(?seed).
export interface NavValue {
  /** 연습 게이트 — verified Learner 면 즉시 action, 익명이면 로그인 모달 띄우고 보류. */
  requireLearner: (action: () => void) => void;
  /** 단일 문항 학습 — 게이트 후 퀴즈 컨트롤러로 띄우고 /quiz 라우트로 이동. */
  studyOne: (qn: number) => void;
  /** 서비스명으로 개념 라우트로 이동(검색 시드). */
  openConceptFor: (svc: string) => void;
}

export const NavContext = createContext<NavValue | null>(null);

export function useNav(): NavValue {
  const c = useContext(NavContext);
  if (!c) throw new Error("useNav must be used within NavContext.Provider");
  return c;
}
