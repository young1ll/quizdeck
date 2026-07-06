import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/route-guards";
import { loadExamLocalized } from "@/lib/content";
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
  await requireAdminPage();
  const { provider, exam } = await params;
  const data = await loadExamLocalized(provider, exam);
  if (!data) notFound();

  // 어드민 복귀(← 어드민)는 admin 레이아웃 헤더의 브랜드가 소유(ADR-0010 슬라이스 D).
  return (
    <ContentEditor
      examKey={`${provider}/${exam}`}
      defaultLang={data.meta.language}
      questions={data.questions}
      concepts={data.concepts}
    />
  );
}
