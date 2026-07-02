"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LuUser, LuLogOut } from "react-icons/lu";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { useSession, signOut } from "@/lib/auth-client";
import { isLearner } from "@/lib/learner";

// learner shell 헤더의 계정 칩 (ADR-0010 결정 2·3 · ADR-0013 · ADR-0014 Phase 2). 검증된 Learner 면
// 이름 트리거 → **astryx DropdownMenu**(마이페이지 · 로그아웃), 익명이면 로그인→/login.
//
// ADR-0013 은 메뉴 a11y 비용 때문에 드롭다운을 포기하고 "데스크톱 상시 로그아웃 / 모바일은 깊게"로
// 우회했다. ADR-0014 가 astryx Menu(포커스·키보드·ARIA 무료)로 그 드롭다운을 해금 — 이제 **모든
// 뷰포트에서** 로그아웃이 메뉴로 발견 가능해져(디스커버리 의도 계승) 반응형 우회가 불필요해졌다.
// 술어는 lib/learner(클라-안전) 공유.
const chipLink = "flex min-h-[44px] items-center text-sm text-[var(--muted)] hover:text-[var(--fg)]";

export default function AccountChip() {
  const { data: session } = useSession();
  const router = useRouter();

  if (!isLearner(session)) {
    return (
      <Link href="/login" className={chipLink}>
        로그인
      </Link>
    );
  }

  const name = session?.user?.name?.trim();
  const logout = async () => {
    // MyPage(/me/account) 로그아웃과 같은 경로 — signOut 후 full reload 로 홈(세션·캐시 정리).
    await signOut().catch(() => {});
    window.location.href = "/";
  };

  return (
    <DropdownMenu
      button={{ label: name || "마이페이지", variant: "ghost", size: "sm" }}
      hasChevron
      items={[
        { label: "마이페이지", icon: <LuUser />, onClick: () => router.push("/me") },
        { type: "divider" },
        { label: "로그아웃", icon: <LuLogOut />, onClick: logout },
      ]}
    />
  );
}
