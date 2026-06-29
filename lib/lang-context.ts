"use client";

import { createContext, useContext } from "react";

// 현재 표시 언어 (이슈 #28 / ADR-0005 C). ExamApp 이 제공, LangToggle·뷰가 소비.
// 같은 Question 의 언어 변형만 — qn·정답·Progress 는 언어 무관(전환해도 그대로).
export interface LangValue {
  lang: string;
  setLang: (lang: string) => void;
  available: string[];
}

export const LangContext = createContext<LangValue | null>(null);

export function useLang(): LangValue {
  const c = useContext(LangContext);
  if (!c) throw new Error("useLang must be used within LangContext.Provider");
  return c;
}
