"use client";

import { createContext, useContext } from "react";

export type View =
  | "home"
  | "setup"
  | "quiz"
  | "result"
  | "concept"
  | "diagram"
  | "map"
  | "search"
  | "history";

export interface NavValue {
  view: View;
  go: (view: View) => void;
  /** 단일 문항 학습 세션 시작 후 quiz 뷰로 */
  studyOne: (qn: number) => void;
  /** concept 뷰로 이동하며 해당 서비스명으로 검색 시드 설정 */
  openConceptFor: (svc: string) => void;
  /** concept 뷰가 소비할 초기 검색어(소비 후 clearSeed) */
  conceptSeed: string;
  clearConceptSeed: () => void;
}

export const NavContext = createContext<NavValue | null>(null);

export function useNav(): NavValue {
  const c = useContext(NavContext);
  if (!c) throw new Error("useNav must be used within NavContext.Provider");
  return c;
}
