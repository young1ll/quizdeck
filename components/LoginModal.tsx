"use client";

import { useEffect } from "react";
import AuthForms from "./AuthForms";

// 연습 게이트 모달 (이슈 #22 / ADR-0004). 익명이 연습 모드를 누르면 인플레이스로 뜬다.
// 로그인 성공 시엔 호출부(ExamInner)가 useSession 변화를 감지해 막혔던 연습을 이어가며 닫는다.
// 신규 가입은 AuthForms 가 "메일 확인" 안내로 끝나고 모달은 사용자가 닫는다.
export default function LoginModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="relative" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="absolute -right-2 -top-2 z-10 grid h-7 w-7 place-items-center rounded-full border border-[var(--border)] bg-[var(--panel)] text-xs text-[var(--muted)] hover:text-[var(--fg)]"
        >
          ✕
        </button>
        <p className="mb-2 text-center text-sm font-semibold">로그인하고 학습 시작</p>
        <AuthForms />
      </div>
    </div>
  );
}
