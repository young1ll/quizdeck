"use client";

import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import { isLearner } from "@/lib/learner";

// learner shell 헤더의 계정 칩 (ADR-0010 결정 2·3). 검증된 Learner 면 이름→마이페이지, 익명이면
// 로그인→/login(슬라이스 C). 로그아웃·계정관리는 /me 가 소유. 술어는 lib/learner(클라-안전) 공유.
// 터치 타겟 ≥44px.
const chip = "flex min-h-[44px] items-center text-sm text-[var(--muted)] hover:text-[var(--fg)]";

export default function AccountChip() {
  const { data: session } = useSession();
  if (!isLearner(session)) {
    return (
      <Link href="/login" className={chip}>
        로그인
      </Link>
    );
  }
  const name = session?.user?.name?.trim();
  return (
    <Link href="/me" className={chip}>
      {name || "마이페이지"}
    </Link>
  );
}
