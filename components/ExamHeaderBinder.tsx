"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { useExam } from "@/lib/exam-context";
import { useQuizFlow } from "@/lib/quiz-flow-context";
import { useSession } from "@/lib/auth-client";
import { isAdminSession } from "@/lib/admin-role";
import AccountChip from "@/components/AccountChip";
import { useSetHeaderSlot } from "@/lib/header-slot";

// exam 섹션의 맥락 헤더 바인더 (ADR-0012 결정 5·6·9·10). ExamProviders 안쪽(useExam·useQuizFlow 가용)에서
// 헤더 슬롯을 채운다. 3단 적응(결정 6):
//  · 퀴즈 active(/quiz + phase active) → focus chrome: `진행 n/N · [타이머] · 나가기`. 검색·허브·계정 숨김
//    (집중, 결정 9). 나가기=quiz.quit(세션을 store.active 에 보존 → 허브 이어하기 배너, 비파괴).
//  · 그 외 exam 안 → `‹시험코드(→허브) · [✏️편집(admin)] · 🔎검색 · 계정`(결정 5·10).
// 시각 출력 없음(슬롯만 설정). 바깥(카탈로그·/me)의 기본 헤더는 LearnerHeader 가 슬롯 없을 때 렌더.
const fmtTime = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

export default function ExamHeaderBinder() {
  const { meta } = useExam();
  const { quiz, phase } = useQuizFlow();
  const { data: session } = useSession();
  const pathname = usePathname();
  const admin = isAdminSession(session);
  const base = `/${meta.provider}/${meta.slug}`;
  const adminHref = `/admin/${meta.provider}/${meta.slug}`;

  const s = quiz.session;
  const activeQuiz = phase === "active" && !!s && !!pathname?.endsWith("/quiz");
  const idx = s?.idx ?? 0;
  const len = s?.queue.length ?? 0;
  const exam = s?.exam ?? false;
  const timeLeft = quiz.timeLeft;
  const quit = quiz.quit;

  const node = useMemo(() => {
    if (activeQuiz) {
      return (
        <>
          <span className="font-mono text-sm text-[var(--muted)]">
            진행 {idx + 1} / {len}
          </span>
          <div className="flex shrink-0 items-center gap-3">
            {exam && timeLeft !== null && (
              <span
                className={`rounded-md px-2 py-0.5 font-mono text-xs ${
                  timeLeft < 300 ? "bg-[var(--bad)] text-white" : "bg-[var(--panel-2)]"
                }`}
              >
                ⏱ {fmtTime(Math.max(0, timeLeft))}
              </span>
            )}
            <button
              type="button"
              onClick={quit}
              className="flex min-h-[44px] items-center text-sm text-[var(--muted)] hover:text-[var(--bad)]"
            >
              나가기
            </button>
          </div>
        </>
      );
    }
    return (
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
    );
  }, [activeQuiz, idx, len, exam, timeLeft, quit, base, adminHref, admin, meta.code]);

  useSetHeaderSlot(node);
  return null;
}
