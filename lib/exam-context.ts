"use client";

import { createContext, useContext } from "react";
import type { Concept, Diagram, ExamMeta, Question } from "./types";
import type { TopicOption } from "./session";

export interface ExamContextValue {
  meta: ExamMeta;
  questions: Question[];
  concepts: Concept[];
  diagrams: Diagram[];
  q2svc: Record<string, string[]>;
  icons: Record<string, string>;
  /** qn → Question */
  byQn: Map<number, Question>;
  /** 등장 주제 목록 — 안정 id + 현재 언어 라벨(Setup 필터 value = id). */
  topics: TopicOption[];
}

export const ExamContext = createContext<ExamContextValue | null>(null);

export function useExam(): ExamContextValue {
  const c = useContext(ExamContext);
  if (!c) throw new Error("useExam must be used within ExamContext.Provider");
  return c;
}
