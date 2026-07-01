"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

// 적응형 맥락 헤더의 슬롯 (ADR-0012 결정 6). learner shell 헤더는 (learner)/layout 에 있고 exam 이름·
// 퀴즈 phase 는 ExamProviders **안쪽** 컨텍스트라 바깥 헤더가 못 읽는다. 슬롯으로 뒤집는다 — 헤더는
// 슬롯을 렌더하고(없으면 기본), 안쪽 섹션(ExamHeaderBinder)이 자기 맥락을 슬롯에 채운다. 두 줄로
// 쌓지 않는 단일 적응형 헤더가 이렇게 성립한다.

type SlotCtx = { node: ReactNode | null; set: (n: ReactNode | null) => void };
const HeaderSlotContext = createContext<SlotCtx | null>(null);

export function HeaderSlotProvider({ children }: { children: ReactNode }) {
  const [node, setNode] = useState<ReactNode | null>(null);
  return (
    <HeaderSlotContext.Provider value={{ node, set: setNode }}>{children}</HeaderSlotContext.Provider>
  );
}

/** 헤더가 읽는다 — 채워졌으면 맥락 헤더, 아니면 null(기본 헤더). */
export function useHeaderSlot(): ReactNode | null {
  return useContext(HeaderSlotContext)?.node ?? null;
}

/**
 * 안쪽 섹션이 헤더 내용을 채운다. 언마운트(섹션 이탈) 시 비워 기본 헤더로 복귀한다. node 는 호출부에서
 * useMemo 로 안정화해 넘긴다(매 렌더 set 방지).
 */
export function useSetHeaderSlot(node: ReactNode) {
  const ctx = useContext(HeaderSlotContext);
  const set = ctx?.set;
  useEffect(() => {
    set?.(node);
    return () => set?.(null);
  }, [set, node]);
}
