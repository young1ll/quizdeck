import { notFound } from "next/navigation";
import Link from "next/link";
import { requireLearnerPage } from "@/lib/route-guards";
import { Container } from "@/components/ui/Container";
import { pool } from "@/lib/db";
import { getCollection } from "@/lib/collection-db";
import { groupItemsByExam } from "@/lib/collection";
import { listExamsCms, loadQuestionsByKeysCms } from "@/cms/serve";
import type { ExamSummary } from "@/lib/types";
import CollectionDetail, {
  type CollectionGroupView,
} from "@/components/collections/CollectionDetail";

// 컬렉션 상세 (ADR-0022 S1.5). RSC 가 컬렉션(learner 스코프) + 참조 문항 미리보기(배치 IN 조회 —
// cross-exam 전체 로드가 아니라 참조된 행만, ADR-0022 재개봉 근거)를 모아 클라이언트 상세에 넘긴다.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 미리보기 투영 — ko 슬롯 우선, 없으면 첫 슬롯. 마크다운 강조만 벗겨 한 줄로.
function preview(content: Record<string, { q?: string }> | undefined): string | null {
  if (!content) return null;
  const slot = content.ko ?? Object.values(content)[0];
  const q = slot?.q;
  return q ? q.replace(/\*\*/g, "").slice(0, 90) : null;
}

export default async function CollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireLearnerPage();
  const { id } = await params;
  const col = await getCollection(pool, session.user.id, id);
  if (!col) notFound();

  const exams = await listExamsCms();
  const metaByKey = new Map<string, ExamSummary>(
    exams.map((e) => [`${e.provider}/${e.slug}`, e]),
  );
  const rows = await loadQuestionsByKeysCms(col.items);
  const byKey = new Map<string, (typeof rows)[number]["content"]>(
    rows.map((r) => [`${r.examKey}#${r.qn}`, r.content]),
  );

  const groups: CollectionGroupView[] = groupItemsByExam(col.items).map((g) => {
    const meta = metaByKey.get(g.examKey);
    return {
      examKey: g.examKey,
      known: !!meta,
      name: meta?.name ?? g.examKey,
      code: meta?.code ?? g.examKey,
      icon: meta?.icon,
      href: meta ? `/${meta.provider}/${meta.slug}` : "",
      items: g.qns.map((qn) => ({ qn, preview: preview(byKey.get(`${g.examKey}#${qn}`)) })),
    };
  });

  return (
    <Container size="sm" className="py-8">
      <div className="mb-4">
        <Link
          href="/me/collections"
          className="text-sm text-[var(--muted)] hover:text-[var(--fg)]"
        >
          ‹ 내 컬렉션
        </Link>
      </div>
      <CollectionDetail collection={col} groups={groups} />
    </Container>
  );
}
