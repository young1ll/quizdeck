import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { pool } from "@/lib/db";
import { listExams } from "@/lib/content";
import { loadAllProgress } from "@/lib/progress-db";
import { buildDashboard } from "@/lib/dashboard";
import { today } from "@/lib/dates";
import Dashboard from "@/components/Dashboard";
import MyPage from "@/components/MyPage";

// 마이페이지 — Learner 허브(이슈 #36/#37 · ADR-0006). 활동(학습 현황) + 계정 관리. requireEmail-
// Verification 때문에 세션 존재 = 검증된 Learner 이므로 세션 없으면 홈으로(익명·미인증 → 로그인 유도).
// 대시보드는 RSC 가 progress 전 행을 DB 에서 직접 읽어 순수 함수로 집계(ADR-0006 결정 5 — 새 API 무).
// 세션·DB 의존이라 동적, node 런타임.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function Me() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");

  // 전 Exam Progress(동기화된 DB 소스) + 카탈로그 meta(문항 수·이름·링크) → 집계.
  const rows = await loadAllProgress(pool, session.user.id);
  const totalByKey: Record<string, number> = {};
  const meta: Record<string, { name: string; code: string; href: string }> = {};
  for (const e of listExams()) {
    const key = `${e.provider}/${e.slug}`;
    totalByKey[key] = e.questionCount;
    meta[key] = { name: e.name, code: e.code, href: `/${e.provider}/${e.slug}` };
  }
  const dashboard = buildDashboard(rows, totalByKey, today());

  return (
    <main className="mx-auto max-w-lg px-5 py-10">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/" className="text-sm text-[var(--muted)] hover:text-[var(--fg)]">
          ← 홈
        </Link>
        <h1 className="text-2xl font-bold">마이페이지</h1>
      </div>
      <div className="space-y-5">
        <Dashboard data={dashboard} meta={meta} />
        <MyPage name={session.user.name} email={session.user.email} />
      </div>
    </main>
  );
}
