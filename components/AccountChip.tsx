"use client";

import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import { isLearner } from "@/lib/learner";

// learner shell 헤더의 계정 칩 (ADR-0010 결정 2). 검증된 Learner 면 이름→마이페이지(전역 접근).
// 로그인 폼·로그아웃은 home AccountMenu·연습 게이트가 소유하므로(/login 라우트는 슬라이스 C) 익명이면
// 칩을 숨긴다. 술어는 lib/learner(클라-안전) 공유. 터치 타겟 ≥44px.
export default function AccountChip() {
  const { data: session } = useSession();
  if (!isLearner(session)) return null;
  const name = session?.user?.name?.trim();
  return (
    <Link
      href="/me"
      className="flex min-h-[44px] items-center text-sm text-[var(--muted)] hover:text-[var(--fg)]"
    >
      {name || "마이페이지"}
    </Link>
  );
}
