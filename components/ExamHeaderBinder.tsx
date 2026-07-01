"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useExam } from "@/lib/exam-context";
import AccountChip from "@/components/AccountChip";
import { useSetHeaderSlot } from "@/lib/header-slot";

// exam 섹션의 맥락 헤더 바인더 (ADR-0012 결정 5·6). ExamProviders 안쪽(useExam 가용)에서 헤더 슬롯을
// `‹시험코드(→허브) · 🔎검색 · 계정`으로 채운다 — 승격된 검색의 집이자 "지금 이 시험 안" 맥락 + 원탭
// 허브 복귀. 시각 출력 없음(슬롯만 설정). 퀴즈 active 의 focus chrome 은 슬라이스 C2.
export default function ExamHeaderBinder() {
  const { meta } = useExam();
  const base = `/${meta.provider}/${meta.slug}`;
  const node = useMemo(
    () => (
      <>
        <Link
          href={base}
          className="flex min-h-[44px] min-w-0 items-center gap-1 font-semibold tracking-tight hover:text-[var(--accent)]"
        >
          <span aria-hidden className="text-[var(--muted)]">
            ‹
          </span>
          <span className="truncate font-mono text-sm">{meta.code}</span>
        </Link>
        <div className="flex shrink-0 items-center gap-3">
          <Link
            href={`${base}/search`}
            aria-label="검색"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center text-[var(--muted)] hover:text-[var(--fg)]"
          >
            🔎
          </Link>
          <AccountChip />
        </div>
      </>
    ),
    [base, meta.code],
  );
  useSetHeaderSlot(node);
  return null;
}
