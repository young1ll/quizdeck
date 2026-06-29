import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getAdminSession } from "@/lib/admin";
import { loadExam } from "@/lib/content";
import ContentEditor from "@/components/admin/ContentEditor";

// 한 시험의 Question·Concept 편집기 (이슈 #27 / ADR-0005 B). admin 게이트 + DB 콘텐츠 로드 →
// 클라이언트 ContentEditor 가 /api/admin/content 로 CRUD 한다(저장 시 서버가 revalidate).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AdminExamPage({
  params,
}: {
  params: Promise<{ provider: string; exam: string }>;
}) {
  if (!(await getAdminSession(await headers()))) notFound();
  const { provider, exam } = await params;
  const data = await loadExam(provider, exam);
  if (!data) notFound();

  return (
    <>
      <nav className="mx-auto max-w-3xl px-4 pt-6">
        <Link href="/admin" className="text-sm text-[var(--muted)] hover:text-[var(--fg)]">
          ← 어드민
        </Link>
      </nav>
      <ContentEditor
        examKey={`${provider}/${exam}`}
        lang={data.meta.language}
        questions={data.questions}
        concepts={data.concepts}
      />
    </>
  );
}
