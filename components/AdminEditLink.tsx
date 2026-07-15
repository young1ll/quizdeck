"use client";

import { useSession } from "@/lib/auth-client";
import { isAdminSession } from "@/lib/admin";

// 콘텐츠 → WP 편집 딥링크 (프론트-admin 연결성, 2026-07-15). AdminLink 와 같은 규율:
// 클라 술어(isAdminSession)는 노출 여부만 — 권한 경계는 WP 로그인(tailnet 전용)이 지킨다.
// 일반 학습자에겐 렌더되지 않는다.
export default function AdminEditLink({ wpId, className = "" }: { wpId?: number; className?: string }) {
  const { data: session } = useSession();
  if (!wpId || !isAdminSession(session)) return null;
  return (
    <a
      href={`https://wp.myquizdeck.com/wp-admin/post.php?post=${wpId}&action=edit`}
      target="_blank"
      rel="noreferrer"
      className={`shrink-0 text-xs text-[var(--muted)] hover:text-[var(--fg)] ${className}`}
      title="WP admin 에서 편집 (tailnet)"
    >
      ✎ 편집
    </a>
  );
}
