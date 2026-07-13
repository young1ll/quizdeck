import { headers } from "next/headers";
import { getPayload } from "payload";
import config from "@payload-config";
import type { Question as QuestionDomain } from "../lib/types.ts";

// draft 프리뷰 로더 (ADR-0024 2차 확장 A). 프리뷰 라우트 전용 — **CMS 세션(admin|author)
// 필수**: 초안은 게시 전 콘텐츠라 익명에 노출되면 안 된다. payload.auth 가 cms/auth-strategy
// (better-auth 세션)를 그대로 태우므로 별도 가드 구현이 없다. 미인증은 null → 호출부 notFound.

export async function authedPayload() {
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: await headers() });
  return user ? payload : null;
}

/** 단일 문항의 draft 최신본 → 렌더용 Question 투영(ko — 현행 데이터 로케일). */
export async function loadDraftQuestion(
  id: string,
): Promise<{ question: QuestionDomain & { image?: string }; examCode: string; status: string } | null> {
  const payload = await authedPayload();
  if (!payload) return null;
  const doc = await payload
    .findByID({ collection: "questions", id: Number(id), draft: true, depth: 1, locale: "ko", overrideAccess: true })
    .catch(() => null);
  if (!doc) return null;
  const options: Record<string, string> = {};
  for (const row of doc.options ?? []) options[row.key] = row.text ?? "";
  const exam = doc.exam as { code?: string } | number;
  return {
    question: {
      qn: doc.qn,
      topic: doc.topic ?? "",
      q: doc.q ?? "",
      options,
      answer: (doc.answer ?? []) as string[],
      explanation: doc.explanation ?? undefined,
      tip: doc.tip ?? undefined,
      image: doc.image && typeof doc.image === "object" ? (doc.image.url ?? undefined) : undefined,
    },
    examCode: typeof exam === "object" ? (exam.code ?? "?") : "?",
    status: doc._status ?? "draft",
  };
}

/** 문제집 draft 최신본 + published 콘텐츠 수 — 카탈로그 카드/허브 헤더 프리뷰용. */
export async function loadDraftExam(id: string) {
  const payload = await authedPayload();
  if (!payload) return null;
  const doc = await payload
    .findByID({ collection: "exams", id: Number(id), draft: true, depth: 0, overrideAccess: true })
    .catch(() => null);
  if (!doc) return null;
  const [q, c] = await Promise.all([
    payload.count({
      collection: "questions",
      where: { and: [{ exam: { equals: doc.id } }, { _status: { equals: "published" } }] },
      overrideAccess: true,
    }),
    payload.count({
      collection: "concepts",
      where: { and: [{ exam: { equals: doc.id } }, { _status: { equals: "published" } }] },
      overrideAccess: true,
    }),
  ]);
  return { exam: doc, questionCount: q.totalDocs, conceptCount: c.totalDocs };
}
