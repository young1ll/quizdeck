import Link from "next/link";
import AccountChip from "@/components/AccountChip";

// (learner) 섹션 shell (ADR-0010 결정 2·7). mobile-first — 슬림 sticky 헤더(로고→home + 계정 칩) +
// safe-area(viewport-fit:cover 와 짝). home·학습·마이페이지가 이 chrome 을 공유하고, 본문 폭은 각
// 페이지가 Container 로 잡는다(섹션 안에서 home 은 넓게·/me 는 좁게).
export default function LearnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header
        className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--bg)]"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex h-12 w-full max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="flex min-h-[44px] items-center font-bold tracking-tight hover:text-[var(--accent)]"
          >
            QuizDeck
          </Link>
          <AccountChip />
        </div>
      </header>
      {children}
    </div>
  );
}
