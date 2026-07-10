import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { requireAdminPage } from "@/lib/route-guards";
import { listExams } from "@/lib/content";
import { pool } from "@/lib/db";
import { applyIconOverrides } from "@/lib/catalog";
import { loadIconOverrides } from "@/lib/exam-icon-db";
import ExamIconEditor from "@/components/admin/ExamIconEditor";

// 어드민 콘텐츠 — Exam 편집 목록 (이슈 #27 / ADR-0005 B · ADR-0017 허브 재편). admin role 아니면
// notFound(존재를 드러내지 않음). /admin 허브의 '콘텐츠' 영역 — 편집기는 /admin/content/[prov]/[exam].
// 문제집 아이콘은 여기서 즉시 수정(ADR-0023 — DB 오버라이드, 파일 meta 는 기본값).
// 세션 의존이라 동적. pg(세션 조회)는 node 런타임.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AdminContent() {
  await requireAdminPage();
  const overrides = await loadIconOverrides(pool);
  const exams = applyIconOverrides(listExams(), overrides);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold">콘텐츠 편집</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">편집할 시험을 선택하세요. 저장 시 시험 페이지에 즉시 반영됩니다.</p>
      <ul className="mt-6 space-y-2">
        {exams.map((e) => {
          const key = `${e.provider}/${e.slug}`;
          return (
            <li key={key}>
              <Card padding={4} interactive>
                <ExamIconEditor examKey={key} icon={e.icon} overridden={key in overrides}>
                  <Link href={`/admin/content/${e.provider}/${e.slug}`} className="min-w-0 flex-1">
                    <div className="font-mono text-xs text-[var(--accent)]">{e.code}</div>
                    <div className="mt-1 font-medium">{e.name}</div>
                    <div className="mt-1 text-xs text-[var(--muted)]">문항 {e.questionCount}개</div>
                  </Link>
                </ExamIconEditor>
              </Card>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
