"use client";

import Link from "next/link";
import { useExam } from "@/lib/exam-context";

// 참조 라우트(개념·검색 등)에서 exam 허브로 복귀 (ADR-0010 슬라이스 B, hub-and-spoke). 모바일은
// 브라우저 뒤로가기로도 돌아오지만 명시 링크를 둔다. shell 헤더 로고는 앱 home(허브 아님)이라 별개.
export default function BackToHub() {
  const { meta } = useExam();
  return (
    <Link
      href={`/${meta.provider}/${meta.slug}`}
      className="mb-4 inline-flex min-h-[44px] max-w-full items-center gap-1 truncate text-sm text-[var(--muted)] hover:text-[var(--fg)]"
    >
      ← <span className="truncate">{meta.name}</span>
    </Link>
  );
}
