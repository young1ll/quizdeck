import Link from "next/link";

// admin 섹션 chrome (ADR-0010 결정 1·2, 슬라이스 D). 관리자는 desktop-first(콘텐츠 편집 = 키보드·
// 넓은 화면)라 learner shell 과 별개의 admin 헤더를 둔다 — 어드민 home 으로의 브랜드 + 앱 복귀.
// 본문 폭은 각 페이지가 잡는다(편집기는 max-w-3xl). admin 게이트는 각 페이지가 getAdminSession 으로.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--bg)]">
        <div className="mx-auto flex h-12 w-full max-w-3xl items-center gap-4 px-4">
          <Link
            href="/admin"
            className="flex min-h-[44px] items-center font-bold tracking-tight hover:text-[var(--accent)]"
          >
            QuizDeck 어드민
          </Link>
          <Link
            href="/"
            className="ml-auto flex min-h-[44px] items-center text-sm text-[var(--muted)] hover:text-[var(--fg)]"
          >
            ← 앱
          </Link>
        </div>
      </header>
      {children}
    </div>
  );
}
