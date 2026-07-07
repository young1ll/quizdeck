"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isLearner } from "./learner";

export interface PracticeGate {
  /** 연습 게이트 — verified Learner 면 즉시 action, 익명이면 로그인 모달 띄우고 보류. */
  requireLearner: (action: () => void) => void;
  /** 로그인 모달을 띄워야 하는가 — 호출부가 <LoginModal/> 렌더 여부로 쓴다. */
  gateOpen: boolean;
  /** 모달 닫기 — 보류한 액션도 버린다. */
  closeGate: () => void;
}

// 연습 게이트 (ADR-0004) — 익명 방문자가 **연습**(Session 시작·Progress 기록)을 시도하면 로그인 모달을
// 띄우고 액션을 **보류**했다가, verified 로그인 성공 시 재개한다(전환 유도이지 접근 차단이 아님 — 결정 2).
// isLearner 로 "누가 연습 가능한가"를 판정한다(emailVerified === true — session 존재로 단순화 금지, ADR-0004
// 애던덤). 신규 가입은 세션이 아직 없어 보류가 유지된다('메일 확인' 상태로 끝남 — 결정 5).
// **헤드리스**: 모달 렌더는 호출부(JSX)가 gateOpen/closeGate 로 한다 — 로직(pending·resume-after-login)만
// 여기 담아 renderHook 으로 단독 검증 가능(인터페이스가 테스트 표면).
export function usePracticeGate(session: Parameters<typeof isLearner>[0]): PracticeGate {
  const learner = isLearner(session);
  const [gateOpen, setGateOpen] = useState(false);
  const pending = useRef<(() => void) | null>(null);

  const requireLearner = useCallback(
    (action: () => void) => {
      if (learner) {
        action();
        return;
      }
      pending.current = action;
      setGateOpen(true);
    },
    [learner],
  );

  // 로그인 성공 → 보류한 연습 액션 재개(모달 닫기). 신규 가입은 세션이 없어 보류 유지.
  useEffect(() => {
    if (learner && gateOpen) {
      const a = pending.current;
      pending.current = null;
      setGateOpen(false);
      a?.();
    }
  }, [learner, gateOpen]);

  const closeGate = useCallback(() => {
    pending.current = null;
    setGateOpen(false);
  }, []);

  return { requireLearner, gateOpen, closeGate };
}
