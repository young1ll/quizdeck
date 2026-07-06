"use client";

import Link from "next/link";
import { LuSettings } from "react-icons/lu";
import { useSession } from "@/lib/auth-client";
import { isAdminSession } from "@/lib/admin";

// /me 의 보조 admin 진입 (ADR-0012 결정 10). role=admin 일 때만 '어드민'(→ /admin 전체 목록)을 렌더하고,
// 일반 Learner 엔 아무것도 안 보인다. 주 진입은 exam 맥락 헤더의 '이 시험 편집'(ExamHeaderBinder) — 여긴
// "전체 관리로" 가는 문. 클라 술어(isAdminSession)로 조건부 — 권한 경계는 서버 getAdminSession 이 지킨다.
export default function AdminLink() {
  const { data: session } = useSession();
  if (!isAdminSession(session)) return null;
  return (
    <Link
      href="/admin"
      className="flex min-h-[44px] items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--fg)]"
    >
      <LuSettings className="size-4" aria-hidden /> 어드민
    </Link>
  );
}
