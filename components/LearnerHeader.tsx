"use client";

import Link from "next/link";
import AccountChip from "@/components/AccountChip";
import { useHeaderSlot } from "@/lib/header-slot";

// learner shell 의 적응형 단일 헤더 (ADR-0012 결정 6). 슬롯이 채워졌으면(exam 안) 맥락 헤더를, 아니면
// 기본(카탈로그·/me)을 렌더한다. 두 줄로 쌓지 않는다 — exam 섹션이 같은 한 줄을 자기 맥락으로 바꾼다.
// safe-area(viewport-fit:cover 와 짝) 유지. 터치 타겟 ≥44px.
export default function LearnerHeader() {
  const slot = useHeaderSlot();
  return (
    <header
      className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--bg)]"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="mx-auto flex h-12 w-full max-w-3xl items-center justify-between gap-3 px-4 sm:px-6">
        {slot ?? (
          <>
            <Link
              href="/"
              className="flex min-h-[44px] items-center font-bold tracking-tight hover:text-[var(--accent)]"
            >
              QuizDeck
            </Link>
            <AccountChip />
          </>
        )}
      </div>
    </header>
  );
}
