import { notFound } from "next/navigation";
import Markdown from "@/components/Markdown";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import RefreshOnSave from "@/components/cms/RefreshOnSave";
import { loadDraftQuestion } from "@/cms/preview";

// 단일 문항 draft 프리뷰 (ADR-0024 2차 확장 A) — admin 편집 화면의 라이브 프리뷰 iframe 이
// 이 라우트를 띄운다. 학습 화면의 문항 카드와 같은 표현(지문 마크다운·이미지·보기·해설·팁)을
// **정적으로**(퀴즈 상태 없이, 정답 하이라이트 상시) 렌더 — 편집 미리보기 목적에 맞는 형태.
// CMS 세션 필수(loadDraftQuestion 이 검증) — 미인증·미존재는 notFound.
export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // draft 는 절대 캐시하지 않는다

export default async function QuestionPreview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadDraftQuestion(id);
  if (!data) notFound();
  const { question: q, examCode, status } = data;

  return (
    <Container className="py-6">
      <RefreshOnSave />
      <div className="mb-3 flex items-center gap-2 text-xs text-[var(--muted)]">
        <span className="font-mono text-[var(--accent)]">{examCode}</span>
        <span>Q{q.qn} 프리뷰</span>
        {status !== "published" && (
          <span className="rounded border border-[var(--border)] px-1.5 py-0.5">초안</span>
        )}
      </div>
      <Card padding={5}>
        {q.topic && <div className="mb-2 text-xs text-[var(--muted)]">{q.topic}</div>}
        <Markdown text={q.q} className="leading-relaxed" />
        {q.image && (
          <img
            src={q.image}
            alt="지문 이미지"
            className="mt-3 max-w-full rounded border border-[var(--border)]"
          />
        )}
        <ul className="mt-5 space-y-2">
          {Object.entries(q.options).map(([key, text]) => {
            const isAnswer = q.answer.includes(key);
            return (
              <li
                key={key}
                className={`rounded border px-3 py-2 text-sm ${
                  isAnswer
                    ? "border-[var(--good)] bg-[color-mix(in_srgb,var(--good)_12%,transparent)]"
                    : "border-[var(--border)] bg-[var(--panel-2)]"
                }`}
              >
                <span className="mr-2 font-mono text-xs">{key}</span>
                <Markdown text={text} className="inline" />
                {isAnswer && <span className="ml-2 text-xs text-[var(--good)]">정답</span>}
              </li>
            );
          })}
        </ul>
        {q.explanation && (
          <div className="mt-5 border-t border-[var(--border)] pt-4">
            <div className="mb-1 text-xs font-semibold text-[var(--muted)]">해설</div>
            <Markdown text={q.explanation} className="text-sm" />
          </div>
        )}
        {q.tip && (
          <div className="mt-3">
            <div className="mb-1 text-xs font-semibold text-[var(--muted)]">팁</div>
            <Markdown text={q.tip} className="text-sm text-[var(--muted)]" />
          </div>
        )}
      </Card>
    </Container>
  );
}
