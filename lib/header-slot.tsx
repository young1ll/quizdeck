"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { HeaderModel } from "./header-model";

// 적응형 맥락 헤더의 슬롯 (ADR-0012 결정 6). learner shell 헤더는 (learner)/layout 에 있고 exam 이름·
// 퀴즈 phase 는 ExamProviders **안쪽** 컨텍스트라 바깥 헤더가 못 읽는다. 슬롯으로 뒤집는다 — 안쪽 섹션
// (ExamHeaderBinder)이 **모델(데이터)**을 슬롯에 채우고, 헤더(LearnerHeader)가 그 모델을 렌더한다.
// 옛날엔 슬롯이 불투명 JSX(ReactNode)를 날라 shell 이 채울 내용을 통제 못 했다 — 이제 데이터라 결정은
// 순수(lib/header-model)·shell 이 프레임/chrome 을 소유한다. onExit 만 안쪽 컨텍스트(quiz.quit)라 함께 실린다.
export interface HeaderSlot {
  model: HeaderModel;
  onExit: () => void; // 퀴즈 나가기(안쪽 컨텍스트의 quiz.quit) — quiz 모델일 때만 shell 이 쓴다
}

type SlotCtx = { slot: HeaderSlot | null; set: (s: HeaderSlot | null) => void };
const HeaderSlotContext = createContext<SlotCtx | null>(null);

export function HeaderSlotProvider({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HeaderSlot | null>(null);
  return (
    <HeaderSlotContext.Provider value={{ slot, set: setSlot }}>{children}</HeaderSlotContext.Provider>
  );
}

/** 헤더가 읽는다 — 채워졌으면 맥락 모델, 아니면 null(기본 헤더). */
export function useHeaderSlot(): HeaderSlot | null {
  return useContext(HeaderSlotContext)?.slot ?? null;
}

/**
 * 안쪽 섹션이 헤더 모델을 채운다. 언마운트(섹션 이탈) 시 비워 기본 헤더로 복귀한다. slot 은 호출부에서
 * useMemo 로 안정화해 넘긴다(매 렌더 set 방지).
 */
export function useSetHeaderSlot(slot: HeaderSlot) {
  const ctx = useContext(HeaderSlotContext);
  const set = ctx?.set;
  useEffect(() => {
    set?.(slot);
    return () => set?.(null);
  }, [set, slot]);
}
