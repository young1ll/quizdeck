import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { requireAdminPage } from "@/lib/route-guards";
import { listExams } from "@/lib/content";

// 어드민 콘텐츠 — Exam 편집 목록 (이슈 #27 / ADR-0005 B · ADR-0017 허브 재편). admin role 아니면
// notFound(존재를 드러내지 않음). /admin 허브의 '콘텐츠' 영역 — 편집기는 /admin/content/[prov]/[exam].
// 세션 의존이라 동적. pg(세션 조회)는 node 런타임.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AdminContent() {
  await requireAdminPage();
  const exams = listExams();

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold">콘텐츠 편집</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">편집할 시험을 선택하세요. 저장 시 시험 페이지에 즉시 반영됩니다.</p>
      <ul className="mt-6 space-y-2">
        {exams.map((e) => (
          <li key={`${e.provider}/${e.slug}`}>
            <Link href={`/admin/content/${e.provider}/${e.slug}`} className="block">
              <Card padding={4} interactive>
                <div className="font-mono text-xs text-[var(--accent)]">{e.code}</div>
                <div className="mt-1 font-medium">{e.name}</div>
                <div className="mt-1 text-xs text-[var(--muted)]">문항 {e.questionCount}개</div>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
