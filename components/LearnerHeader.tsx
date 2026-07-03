"use client";

import Link from "next/link";
import { LuSquarePen, LuSearch, LuTimer } from "react-icons/lu";
import AccountChip from "@/components/AccountChip";
import { useHeaderSlot } from "@/lib/header-slot";
import type { HeaderModel } from "@/lib/header-model";

// learner shell 의 적응형 단일 헤더 (ADR-0012 결정 6). exam 섹션(ExamHeaderBinder)이 채운 **모델**을
// 렌더하고, 없으면 기본(카탈로그·/me)을 렌더한다 — shell 이 프레임과 chrome(QuizDeck·계정)을 소유하므로
// 결정(순수 buildHeaderModel)과 표현이 분리되고, chrome 이 한 곳에만 산다(옛날엔 binder 와 여기 중복).
// 두 줄로 쌓지 않는다 — 같은 한 줄을 맥락으로 바꾼다. safe-area 유지 · 터치 타겟 ≥44px.

const fmtTime = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

const homeLink = (
  <Link
    href="/"
    className="flex min-h-[44px] items-center font-bold tracking-tight hover:text-[var(--accent)]"
  >
    QuizDeck
  </Link>
);

export default function LearnerHeader() {
  const slot = useHeaderSlot();
  return (
    <header
      className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--bg)]"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="mx-auto flex h-12 w-full max-w-3xl items-center justify-between gap-3 px-4 sm:px-6">
        {slot ? (
          renderModel(slot.model, slot.onExit)
        ) : (
          <>
            {homeLink}
            <AccountChip />
          </>
        )}
      </div>
    </header>
  );
}

function renderModel(model: HeaderModel, onExit: () => void) {
  if (model.kind === "quiz") {
    // 퀴즈 active focus chrome — 진행·타이머·나가기만(검색·허브·계정 숨김, ADR-0012 결정 9).
    return (
      <>
        <span className="font-mono text-sm text-[var(--muted)]">
          진행 {model.progress.position} / {model.progress.total}
        </span>
        <div className="flex shrink-0 items-center gap-3">
          {model.timer && (
            <span
              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-xs ${
                model.timer.sec < 300 ? "bg-[var(--bad)] text-white" : "bg-[var(--panel-2)]"
              }`}
            >
              <LuTimer className="size-3.5" aria-hidden /> {fmtTime(model.timer.sec)}
            </span>
          )}
          <button
            type="button"
            onClick={onExit}
            className="flex min-h-[44px] items-center text-sm text-[var(--muted)] hover:text-[var(--bad)]"
          >
            나가기
          </button>
        </div>
      </>
    );
  }
  // exam 안 브레드크럼 — QuizDeck › 시험코드 · [편집] · 검색 · 계정 (ADR-0012 결정 5·10).
  return (
    <>
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="shrink-0">{homeLink}</span>
        <span aria-hidden className="shrink-0 text-[var(--muted)]">
          ›
        </span>
        <Link
          href={model.hubHref}
          aria-label="시험 허브"
          className="flex min-h-[44px] min-w-0 items-center hover:text-[var(--fg)]"
        >
          <span className="truncate font-mono text-sm text-[var(--muted)]">{model.examCode}</span>
        </Link>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {model.adminHref && (
          <Link
            href={model.adminHref}
            aria-label="이 시험 편집"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center text-[var(--muted)] hover:text-[var(--accent)]"
          >
            <LuSquarePen className="size-4" aria-hidden />
          </Link>
        )}
        <Link
          href={model.searchHref}
          aria-label="검색"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center text-[var(--muted)] hover:text-[var(--fg)]"
        >
          <LuSearch className="size-[18px]" aria-hidden />
        </Link>
        <AccountChip />
      </div>
    </>
  );
}
