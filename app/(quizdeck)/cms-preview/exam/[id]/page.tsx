import { notFound } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import ExamIcon from "@/components/ui/ExamIcon";
import RefreshOnSave from "@/components/cms/RefreshOnSave";
import { loadDraftExam } from "@/cms/preview";

// 문제집 draft 프리뷰 (ADR-0024 2차 확장 A) — 카탈로그 카드 모형 + 허브 헤더 메타.
// 문제집 편집(이름·아이콘·트랙·언어)이 홈/허브에 어떻게 보일지를 draft 로 미리 확인한다.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ExamPreview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadDraftExam(id);
  if (!data) notFound();
  const { exam: e, questionCount, conceptCount } = data;

  return (
    <Container className="py-6" size="lg">
      <RefreshOnSave />
      <div className="mb-3 flex items-center gap-2 text-xs text-[var(--muted)]">
        <span>문제집 프리뷰</span>
        {e._status !== "published" && (
          <span className="rounded border border-[var(--border)] px-1.5 py-0.5">초안</span>
        )}
      </div>

      {/* 홈 카탈로그 카드 모형 — (learner) home 의 카드 마크업과 동일 구조 */}
      <div className="max-w-sm">
        <Card padding={4} interactive>
          <div className="font-mono text-xs text-[var(--accent)]">
            <ExamIcon icon={e.icon ?? undefined} className="mr-1" />
            {e.code}
          </div>
          <div className="mt-1 font-medium leading-snug">{e.name}</div>
          <div className="mt-2 text-xs text-[var(--muted)]">문항 {questionCount}개</div>
        </Card>
      </div>

      <div className="mt-6 text-sm">
        <table className="border-collapse">
          <tbody>
            {[
              ["examKey", e.examKey],
              ["트랙", e.trackName ? `${e.trackName} (${e.trackId})` : "— (provider 그룹핑)"],
              ["기본 언어", e.language],
              ["게시 콘텐츠", `문항 ${questionCount} · 개념 ${conceptCount}`],
            ].map(([k, v]) => (
              <tr key={k}>
                <td className="pr-4 py-1 text-xs text-[var(--muted)]">{k}</td>
                <td className="py-1">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Container>
  );
}
