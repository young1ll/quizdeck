import { notFound } from "next/navigation";
import { requireLearnerPage } from "@/lib/route-guards";
import { Container } from "@/components/ui/Container";
import { pool } from "@/lib/db";
import { getCollection } from "@/lib/collection-db";
import { loadQuestionsByKeys } from "@/lib/content-db";
import { projectQuestion } from "@/lib/content-localize";
import { listExams } from "@/lib/content";
import { applyIconOverrides } from "@/lib/catalog";
import { loadIconOverrides } from "@/lib/exam-icon-db";
import type { MixedItem } from "@/lib/mixed-session";
import MixedQuizClient, { type MixedExamMeta } from "@/components/collections/MixedQuizClient";
import { EmptyState } from "@astryxdesign/core/EmptyState";

// 컬렉션 혼합 큐 풀기 라우트 (ADR-0022 S2). RSC 가 컬렉션(learner 스코프)의 참조 문항 **풀
// 콘텐츠**(선택지·정답·해설 포함)를 배치 IN 조회로 모아 — 시험 전체 페이로드 없이(그릴링 결정 B
// 근거) — 클라이언트 혼합 퀴즈에 넘긴다. 삭제된 참조 문항은 건너뛴다(컬렉션 순서 보존).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function CollectionQuizPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireLearnerPage();
  const { id } = await params;
  const col = await getCollection(pool, session.user.id, id);
  if (!col) notFound();

  const rows = await loadQuestionsByKeys(pool, col.items);
  const byKey = new Map(rows.map((r) => [`${r.examKey}#${r.qn}`, r]));
  // 컬렉션 순서 보존 + 삭제된 문항 제외. 표시 언어는 ko 우선(혼합 뷰 v1 — 시험별 언어 토글 없음).
  const items: MixedItem[] = [];
  for (const it of col.items) {
    const row = byKey.get(`${it.examKey}#${it.qn}`);
    if (!row) continue;
    items.push({
      examKey: it.examKey,
      qn: it.qn,
      question: projectQuestion({ qn: row.qn, answer: row.answer, content: row.content }, "ko", "ko"),
    });
  }

  const examMeta: Record<string, MixedExamMeta> = {};
  const exams = applyIconOverrides(listExams(), await loadIconOverrides(pool));
  for (const e of exams) examMeta[`${e.provider}/${e.slug}`] = { code: e.code, icon: e.icon };

  return (
    <Container size="lg" className="py-2">
      {items.length === 0 ? (
        <div className="py-16">
          <EmptyState
            isCompact
            title="풀 수 있는 문항이 없습니다"
            description="컬렉션이 비었거나 참조 문항이 삭제되었습니다."
          />
        </div>
      ) : (
        <MixedQuizClient
          collectionId={col.id}
          collectionName={col.name}
          collectionIcon={col.icon}
          items={items}
          examMeta={examMeta}
        />
      )}
    </Container>
  );
}
