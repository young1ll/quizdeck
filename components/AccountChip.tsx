"use client";

import Link from "next/link";
import { useSession, signOut } from "@/lib/auth-client";
import { isLearner } from "@/lib/learner";

// learner shell 헤더의 계정 칩 (ADR-0010 결정 2·3 · ADR-0013). 검증된 Learner 면 이름→마이페이지,
// 익명이면 로그인→/login. 데스크톱(sm+)엔 이름 옆 **상시 로그아웃**을 노출(발견성) — 모바일은 hidden
// 이라 로그아웃은 /me/account 로 깊게(로그인 유지가 정상). 드롭다운 아님(메뉴 a11y·무의존, ADR-0013).
// 술어는 lib/learner(클라-안전) 공유. 터치 타겟 ≥44px.
const chip = "flex min-h-[44px] items-center text-sm text-[var(--muted)] hover:text-[var(--fg)]";
// 로그아웃 — 기본 hidden, 데스크톱만 inline-flex(chip 의 flex 와 충돌 없게 display 유틸을 따로 둔다).
const logoutBtn =
  "hidden min-h-[44px] items-center text-sm text-[var(--muted)] hover:text-[var(--fg)] sm:inline-flex";

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
    <div className="flex items-center gap-3">
      <Link href="/me" className={chip}>
        {name || "마이페이지"}
      </Link>
      <button
        type="button"
        onClick={async () => {
          // MyPage(/me/account) 로그아웃과 같은 경로 — signOut 후 full reload 로 홈(세션·캐시 정리).
          await signOut().catch(() => {});
          window.location.href = "/";
        }}
        className={logoutBtn}
      >
        로그아웃
      </button>
    </div>
  );
}
