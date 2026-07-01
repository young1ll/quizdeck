import { headers } from "next/headers";
import Link from "next/link";
import { listExams } from "@/lib/content";
import { Container } from "@/components/ui/Container";
import { getLearnerSession } from "@/lib/learner-server";
import { pool } from "@/lib/db";
import { loadAllProgress } from "@/lib/progress-db";
import { buildDashboard } from "@/lib/dashboard";
import { today } from "@/lib/dates";

// Home — 재개(act) (ADR-0012 결정 2·3). 로그인 Learner 엔 상단 "이어서 학습"(Progress 기반 최근 시험,
// cross-device 일관, 최대 3) + 카탈로그, 익명엔 카탈로그만. 진도 스코프 사다리의 재개 지점 — 숫자는
// 최소(Mastery 만; 상세는 허브/stats). "이어서" 는 허브로 진입(허브의 resume 배너가 진행 중 세션을
// 소유 — Session 은 기기 로컬이라 Home 서버 렌더가 다루지 않는다). 세션 의존이라 동적, node 런타임.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CONTINUE = 3;

export default async function Home() {
  const exams = listExams();

  // provider별 그룹화 (카탈로그)
  const byProvider = new Map<string, typeof exams>();
  for (const e of exams) {
    const arr = byProvider.get(e.providerName) ?? [];
    arr.push(e);
    byProvider.set(e.providerName, arr);
  }

  // 로그인 Learner — 최근 학습한 시험(Progress 기반) 이어서 카드. 익명은 세션 없음 → 카탈로그만.
  const session = await getLearnerSession(await headers());
  const metaByKey = new Map(exams.map((e) => [`${e.provider}/${e.slug}`, e]));
  let cont: { exam: (typeof exams)[number]; mastery: number }[] = [];
  if (session) {
    const rows = await loadAllProgress(pool, session.user.id);
    const totalByKey: Record<string, number> = {};
    for (const e of exams) totalByKey[`${e.provider}/${e.slug}`] = e.questionCount;
    const dash = buildDashboard(rows, totalByKey, today());
    cont = dash.exams
      .slice(0, MAX_CONTINUE)
      .map((s) => ({ exam: metaByKey.get(s.examKey), mastery: s.mastery }))
      .filter((x): x is { exam: (typeof exams)[number]; mastery: number } => !!x.exam);
  }

  return (
    <Container size="lg" className="py-8">
      {/* 브랜드·계정(로고·로그인/마이페이지)은 learner shell 헤더가 소유(ADR-0010 슬라이스 C). 태그라인만. */}
      <header className="mb-8">
        <p className="text-sm text-[var(--muted)]">자격·기술 시험 대비 퀴즈 · 학습</p>
      </header>

      {/* 이어서 학습 — 로그인 Learner 의 최근 시험(ADR-0012 결정 3). 재개 affordance, 숫자 최소. */}
      {cont.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
            이어서 학습
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {cont.map(({ exam, mastery }) => (
              <li key={`${exam.provider}/${exam.slug}`}>
                <Link
                  href={`/${exam.provider}/${exam.slug}/`}
                  className="block rounded-card border border-[var(--accent)]/40 bg-[var(--panel)] p-4 transition-colors hover:border-[var(--accent)]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-mono text-xs text-[var(--accent)]">{exam.code}</div>
                      <div className="mt-1 truncate font-medium leading-snug">{exam.name}</div>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-[var(--accent)]">
                      이어서 →
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--panel-2)]">
                      <div
                        className="h-full bg-[var(--accent)]"
                        style={{ width: `${mastery}%` }}
                      />
                    </div>
                    <span className="shrink-0 text-xs text-[var(--muted)]">숙련도 {mastery}%</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

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
