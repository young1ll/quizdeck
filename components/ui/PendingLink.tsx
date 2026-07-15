"use client";

import Link, { useLinkStatus } from "next/link";
import type { ComponentProps, ReactNode } from "react";

// 클릭 즉시 피드백 링크 — Link 대체품(동일 props). useLinkStatus 로 내비게이션 pending 동안
// 딤 + 코너 스피너를 띄운다(둘 다 지연 등장 — prefetch 된 빠른 내비에선 안 보임). 스타일은
// globals.css .pending-scope 가 소유. 카드형 블록 링크(카탈로그·허브 타일·컬렉션)에 쓴다.
function PendingScope({ children }: { children: ReactNode }) {
  const { pending } = useLinkStatus();
  return (
    <span className="pending-scope" data-pending={pending || undefined}>
      {children}
      <span className="pending-spinner" aria-hidden />
    </span>
  );
}

export function PendingLink({ children, ...rest }: ComponentProps<typeof Link>) {
  return (
    <Link {...rest}>
      <PendingScope>{children}</PendingScope>
    </Link>
  );
}
