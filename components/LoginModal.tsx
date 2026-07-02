"use client";

import { LuX } from "react-icons/lu";
import { Dialog } from "@astryxdesign/core/Dialog";
import { IconButton } from "@astryxdesign/core/IconButton";
import AuthForms from "./AuthForms";

// 연습 게이트 모달 (이슈 #22 / ADR-0004) — astryx Dialog 래퍼 (ADR-0014 Phase 2). 익명이 연습 모드를
// 누르면 인플레이스로 뜬다. 로그인 성공 시엔 호출부(ExamInner)가 useSession 변화를 감지해 막혔던 연습을
// 이어가며 닫는다. 신규 가입은 AuthForms 가 "메일 확인" 안내로 끝나고 사용자가 닫는다.
//
// astryx Dialog = native <dialog>: **포커스 트랩·Escape·backdrop 라이트 디스미스가 무료**
// (ADR-0008 결정 5c 의 hand-rolled useFocusTrap + 수동 keydown 을 대체 — ADR-0014 도입의 실값).
// 부모가 열림일 때만 이 컴포넌트를 마운트하므로 isOpen 고정; 닫힘 요청(onOpenChange false)→onClose.
// purpose="info" = 자유 디스미스. Dialog 가 카드 서피스라 AuthForms 는 bare(셸 제거)로 넣어 중첩 방지.
export default function LoginModal({ onClose }: { onClose: () => void }) {
  return (
    <Dialog
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      purpose="info"
      width={340}
      aria-label="로그인"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">로그인하고 학습 시작</p>
        <IconButton
          icon={<LuX className="size-4" aria-hidden />}
          onClick={onClose}
          variant="ghost"
          size="sm"
          label="닫기"
        />
      </div>
      <AuthForms bare />
    </Dialog>
  );
}
