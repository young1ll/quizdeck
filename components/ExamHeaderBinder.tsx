"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useExam } from "@/lib/exam-context";
import { useSession } from "@/lib/auth-client";
import { isAdminSession } from "@/lib/admin-role";
import AccountChip from "@/components/AccountChip";
import { useSetHeaderSlot } from "@/lib/header-slot";

// exam 섹션의 맥락 헤더 바인더 (ADR-0012 결정 5·6·10). ExamProviders 안쪽(useExam 가용)에서 헤더 슬롯을
// `‹시험코드(→허브) · [✏️편집(admin)] · 🔎검색 · 계정`으로 채운다. admin(role=admin)이면 '이 시험 편집'을
// 얹어 보던 시험의 편집기로 1-홉 딥링크한다 — admin 의 실제 직무는 콘텐츠 편집이라 글로벌 문보다 맥락
// 문이 맞다. 전역 AccountChip 엔 admin 요소를 안 넣는다(전역 헤더 admin-free). 시각 출력 없음(슬롯만).
export default function ExamHeaderBinder() {
  const { meta } = useExam();
  const { data: session } = useSession();
  const admin = isAdminSession(session);
  const base = `/${meta.provider}/${meta.slug}`;
  const adminHref = `/admin/${meta.provider}/${meta.slug}`;
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
          {admin && (
            <Link
              href={adminHref}
              aria-label="이 시험 편집"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center text-[var(--muted)] hover:text-[var(--accent)]"
            >
              ✏️
            </Link>
          )}
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
    [base, adminHref, admin, meta.code],
  );
  useSetHeaderSlot(node);
  return null;
}
