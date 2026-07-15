import { headers } from "next/headers";
import Link from "next/link";
import { LuFolderOpen } from "react-icons/lu";
import { Card } from "@/components/ui/Card";
import ExamIcon from "@/components/ui/ExamIcon";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Container } from "@/components/ui/Container";
import { getLearnerSession } from "@/lib/learner-server";
import { pool } from "@/lib/db";
import { loadAllProgress } from "@/lib/progress-db";
import { buildContinueList, totalMyProblems, type ContinueItem } from "@/lib/dashboard";
import { groupByProvider } from "@/lib/catalog";
import { getSiteConfigCms, listExamsCms } from "@/cms/serve";

// Home — 재개(act) (ADR-0012 결정 2·3). 로그인 Learner 엔 상단 "이어서 학습"(Progress 기반 최근 시험,
// cross-device 일관, 최대 3) + 카탈로그, 익명엔 카탈로그만. 진도 스코프 사다리의 재개 지점 — 숫자는
// 최소(Mastery 만; 상세는 허브/stats). "이어서" 는 허브로 진입(허브의 resume 배너가 진행 중 세션을
// 소유 — Session 은 기기 로컬이라 Home 서버 렌더가 다루지 않는다). 세션 의존이라 동적, node 런타임.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CONTINUE = 3;

export default async function Home() {
  const [exams, site] = await Promise.all([listExamsCms(), getSiteConfigCms()]);

  // 카탈로그 그룹화 — 트랙(자격 계열) 우선, 없으면 provider 폴백(lib/catalog 순수 결정, 데이터 모델 ③).
  const groups = groupByProvider(exams);

  // 로그인 Learner — 최근 학습한 시험(Progress 기반) 이어서 카드. 익명은 세션 없음 → 카탈로그만.
  // 재개 결정(어떤 시험·Mastery·내 문제함 수)은 buildContinueList(순수·핀됨)가 소유(아키텍처 리뷰 C3).
  const session = await getLearnerSession(await headers());
  let cont: ContinueItem[] = [];
  let mineTotal = 0;
  if (session) {
    const rows = await loadAllProgress(pool, session.user.id);
    cont = buildContinueList(rows, exams, MAX_CONTINUE);
    // '내 문제함' 진입점(한 줄) — 전 시험 합계만(숫자 최소, ADR-0012 스코프 규칙). 시험별 목록·풀기는
    // /me 롤업 → 시험 my-problems 로 드릴다운(ADR-0011). 0 이면 진입점 자체를 렌더하지 않는다.
    mineTotal = totalMyProblems(rows);
  }

  return (
    <Container size="lg" className="py-8">
      {/* 브랜드·계정(로고·로그인/마이페이지)은 learner shell 헤더가 소유(ADR-0010 슬라이스 C). 태그라인만. */}
      <header className="mb-8">
        <p className="text-sm text-[var(--muted)]">{site.tagline}</p>
      </header>

      {/* 이어서 학습 — 로그인 Learner 의 최근 시험(ADR-0012 결정 3). 재개 affordance, 숫자 최소. */}
      {cont.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
            이어서 학습
          </h2>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {cont.map(({ exam, mastery, mine }) => (
              <li key={`${exam.provider}/${exam.slug}`}>
                {/* 재개 카드 — astryx Card 서피스(accent 강조 border). 본문 Link→허브 + 내 문제함 하위 Link
                    (중첩 anchor 회피 위해 ClickableCard 아님 Card+Link 구성). ADR-0014 Phase 3. */}
                <Card padding={0} emphasis="accent">
                  <Link href={`/${exam.provider}/${exam.slug}/`} className="block p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-mono text-xs text-[var(--accent)]">
                          <ExamIcon icon={exam.icon} className="mr-1" />
                          {exam.code}
                        </div>
                        <div className="mt-1 truncate font-medium leading-snug">{exam.name}</div>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-[var(--accent)]">
                        이어서 →
                      </span>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <ProgressBar
                        value={mastery}
                        max={100}
                        label={`숙련도 ${mastery}%`}
                        isLabelHidden
                        variant="accent"
                        className="flex-1"
                      />
                      <span className="shrink-0 text-xs text-[var(--muted)]">숙련도 {mastery}%</span>
                    </div>
                  </Link>
                  {/* 내 문제함 — 시험별 오답∪별표∪메모 직접 진입(있을 때만, ADR-0011). */}
                  {mine > 0 && (
                    <Link
                      href={`/${exam.provider}/${exam.slug}/my-problems`}
                      className="flex min-h-[44px] items-center justify-between border-t border-[var(--border)] px-4 text-xs text-[var(--muted)] hover:text-[var(--fg)]"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <LuFolderOpen className="size-3.5" aria-hidden /> 내 문제함
                      </span>
                      <span className="font-semibold text-[var(--fg)]">{mine} →</span>
                    </Link>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 내 문제함 진입점 — 이어서 학습(재개)과 짝인 한 줄 affordance. 카드 하단의 시험별 링크가
          최근 3개 시험만 커버하므로, 전 시험 합계 한 줄이 /me 롤업(시험별 개수·진입점)으로 잇는다. */}
      {mineTotal > 0 && (
        <section className="mb-8">
          <Link href="/me" className="block">
            <Card padding={4} interactive>
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 font-medium">
                  <LuFolderOpen className="size-4 text-[var(--accent)]" aria-hidden />내 문제함{" "}
                  {mineTotal}개
                </span>
                <span className="shrink-0 text-sm text-[var(--muted)]">시험별 보기 ›</span>
              </div>
            </Card>
          </Link>
        </section>
      )}

      {exams.length === 0 ? (
        <EmptyState title="등록된 시험이 없습니다" isCompact />
      ) : (
        <div className="space-y-10">
          {groups.map((p) => (
            <section key={p.provider}>
              {/* provider 헤더 — 계층 멘탈 모델(provider > 트랙 > 시험)의 최상위. 허브 진입점. */}
              <div className="mb-4 flex items-baseline justify-between gap-3">
                <Link href={`/${p.provider}/`} className="text-base font-bold hover:text-[var(--accent)]">
                  {p.providerName}
                </Link>
                <Link
                  href={`/${p.provider}/`}
                  className="shrink-0 text-xs text-[var(--muted)] hover:text-[var(--fg)]"
                >
                  학습 자료 →
                </Link>
              </div>
              <div className="space-y-6 border-l-2 border-[var(--border)] pl-4">
                {p.groups.map((g) => (
                  <section key={g.id}>
                    <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
                      {g.name}
                    </h3>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {g.exams.map((e) => (
                  <li key={`${e.provider}/${e.slug}`}>
                    {/* 카탈로그 카드 — astryx Card 서피스 + Next Link(클라이언트 내비·prefetch 유지, ADR
                        라우팅 보존). ClickableCard 은 plain <a>(풀 리로드)라 미채택. ADR-0014 Phase 3. */}
                    <Link href={`/${e.provider}/${e.slug}/`} className="block">
                      <Card padding={4} interactive>
                        <div className="font-mono text-xs text-[var(--accent)]">
                          <ExamIcon icon={e.icon} className="mr-1" />
                          {e.code}
                        </div>
                        <div className="mt-1 font-medium leading-snug">{e.name}</div>
                        <div className="mt-2 text-xs text-[var(--muted)]">문항 {e.questionCount}개</div>
                      </Card>
                    </Link>
                  </li>
                ))}
              </ul>
                  </section>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <footer className="mt-16 text-center text-xs text-[var(--muted)]">{site.footerText}</footer>
    </Container>
  );
}
