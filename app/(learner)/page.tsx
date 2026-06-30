import Link from "next/link";
import { listExams } from "@/lib/content";
import AccountMenu from "@/components/AccountMenu";
import { Container } from "@/components/ui/Container";

export default function Home() {
  const exams = listExams();

  // provider별 그룹화
  const byProvider = new Map<string, typeof exams>();
  for (const e of exams) {
    const arr = byProvider.get(e.providerName) ?? [];
    arr.push(e);
    byProvider.set(e.providerName, arr);
  }

  return (
    <Container size="lg" className="py-8">
      {/* 브랜드·전역 nav 는 learner shell 헤더(로고→home). 여기선 태그라인 + 계정만. AccountMenu 는
          익명이면 로그인 폼·Learner 면 프로필 — home 의 로그인 surface(슬라이스 C 의 /login 전까지). */}
      <header className="mb-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[var(--muted)]">자격·기술 시험 대비 퀴즈 · 학습</p>
        <AccountMenu />
      </header>

      {exams.length === 0 ? (
        <p className="text-[var(--muted)]">등록된 시험이 없습니다.</p>
      ) : (
        <div className="space-y-8">
          {[...byProvider.entries()].map(([providerName, list]) => (
            <section key={providerName}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
                {providerName}
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {list.map((e) => (
                  <li key={`${e.provider}/${e.slug}`}>
                    <Link
                      href={`/${e.provider}/${e.slug}/`}
                      className="block rounded-card border border-[var(--border)] bg-[var(--panel)] p-4 transition-colors hover:border-[var(--accent)]"
                    >
                      <div className="font-mono text-xs text-[var(--accent)]">
                        {e.code}
                      </div>
                      <div className="mt-1 font-medium leading-snug">
                        {e.name}
                      </div>
                      <div className="mt-2 text-xs text-[var(--muted)]">
                        문항 {e.questionCount}개
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <footer className="mt-16 text-center text-xs text-[var(--muted)]">
        QuizDeck · self-hosted
      </footer>
    </Container>
  );
}
