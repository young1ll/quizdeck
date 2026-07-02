import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Card } from "@astryxdesign/core/Card";
import { getAdminSession } from "@/lib/admin";
import { listExams } from "@/lib/content";

// 어드민 홈 — Exam 목록. admin role 아니면 notFound(존재를 드러내지 않음). (이슈 #27 / ADR-0005 B)
// 세션 의존이라 동적. pg(세션 조회)는 node 런타임.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AdminHome() {
  if (!(await getAdminSession(await headers()))) notFound();
  const exams = listExams();

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold">어드민 — 콘텐츠</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">편집할 시험을 선택하세요. 저장 시 시험 페이지에 즉시 반영됩니다.</p>
      <ul className="mt-6 space-y-2">
        {exams.map((e) => (
          <li key={`${e.provider}/${e.slug}`}>
            <Link href={`/admin/${e.provider}/${e.slug}`} className="block">
              <Card padding={4} className="transition-colors hover:border-[var(--accent)]">
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
