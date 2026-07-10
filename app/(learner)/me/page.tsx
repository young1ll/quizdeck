import Link from "next/link";
import { requireLearnerPage } from "@/lib/route-guards";
import { Container } from "@/components/ui/Container";
import { pool } from "@/lib/db";
import { listExams } from "@/lib/content";
import { applyIconOverrides } from "@/lib/catalog";
import { loadIconOverrides } from "@/lib/exam-icon-db";
import { loadAllProgress } from "@/lib/progress-db";
import { buildDashboard } from "@/lib/dashboard";
import { today } from "@/lib/dates";
import Dashboard from "@/components/Dashboard";
import AdminLink from "@/components/AdminLink";

// 마이페이지 — 전 시험 인덱스(회고) (ADR-0012 결정 2·7). 계정 관리는 /me/account 로 분리(파괴적·
// 저빈도 격리). 진도 스코프 사다리의 최상단(전부) — 시험별 행이 그 시험 허브로 진입. 검증된 Learner
// (getLearnerSession)가 아니면 홈으로. 대시보드는 RSC 가 progress 전 행을 DB 에서 직접 읽어 순수
// 함수로 집계(ADR-0006 결정 5 — 새 API 무). 세션·DB 의존이라 동적, node 런타임.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function Me() {
  const session = await requireLearnerPage();

  // 전 Exam Progress(동기화된 DB 소스) + 카탈로그 meta(문항 수·이름·링크) → 집계.
  const rows = await loadAllProgress(pool, session.user.id);
  const totalByKey: Record<string, number> = {};
  const meta: Record<string, { name: string; code: string; href: string; icon?: string }> = {};
  const exams = applyIconOverrides(listExams(), await loadIconOverrides(pool));
  for (const e of exams) {
    const key = `${e.provider}/${e.slug}`;
    totalByKey[key] = e.questionCount;
    meta[key] = { name: e.name, code: e.code, href: `/${e.provider}/${e.slug}`, icon: e.icon };
  }
  const dashboard = buildDashboard(rows, totalByKey, today());

  return (
    <Container size="sm" className="py-8">
      {/* 전역 home 복귀는 learner shell 헤더(로고). 여기선 제목 + 계정 관리 진입만. */}
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">마이페이지</h1>
        <div className="flex items-center gap-3">
          {/* admin(role=admin)에게만 보이는 보조 진입 — 일반 Learner 엔 렌더 안 됨(ADR-0012 결정 10). */}
          <AdminLink />
          {/* 컬렉션 — 큐레이션 cross-Exam 세트(ADR-0022). /me 계열 스포크. */}
          <Link
            href="/me/collections"
            className="flex min-h-[44px] items-center text-sm text-[var(--muted)] hover:text-[var(--fg)]"
          >
            내 컬렉션 ›
          </Link>
          <Link
            href="/me/account"
            className="flex min-h-[44px] items-center text-sm text-[var(--muted)] hover:text-[var(--fg)]"
          >
            계정 관리 ›
          </Link>
        </div>
      </div>
      <Dashboard data={dashboard} meta={meta} />
    </Container>
  );
}
