import { revalidatePath } from "next/cache";
import { pool } from "@/lib/db";
import { withAdmin, readJson, badRequest, noContent } from "@/lib/route-guards";
import { isValidQuestion, isValidConcept } from "@/lib/content-validate";
import {
  upsertQuestion,
  upsertConcept,
  deleteQuestion,
  deleteConcept,
} from "@/lib/content-db";

// 콘텐츠 변경 API (이슈 #27 / ADR-0005 B). withAdmin 이 admin role 만 통과시킨다(미인증·비admin 균일 403
// — 관리 표면 존재를 안 드러냄, progress 의 401 과 의도적 차이). 저장/삭제 후 해당 Exam 경로를
// revalidatePath 로 무효화해 ISR 캐시를 즉시 갱신(편집 즉시반영). 경계 검증(정답 ⊂ options 등)은
// lib/content-validate(순수 도메인)가 소유 — DB 없이 테스트되고 ContentEditor 도 재사용 가능.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// trailingSlash:true 환경이라 라우트 경로의 슬래시 유무가 갈린다 — 양쪽을 무효화해
// ISR 캐시 silent miss 를 막는다(편집 즉시반영 보장).
function revalidateExam(examKey: string): void {
  revalidatePath(`/${examKey}`);
  revalidatePath(`/${examKey}/`);
}

export const PUT = withAdmin(async (req) => {
  const b = await readJson(req);
  const { examKey, lang, type } = b;
  if (typeof examKey !== "string" || !examKey || typeof lang !== "string" || !lang) {
    throw badRequest("examKey/lang required");
  }

  if (type === "question") {
    if (!isValidQuestion(b.question)) throw badRequest("invalid question (정답 ⊂ options·필수 필드 확인)");
    await upsertQuestion(pool, examKey, b.question, lang);
  } else if (type === "concept") {
    if (typeof b.ord !== "number") throw badRequest("ord required");
    if (!isValidConcept(b.concept)) throw badRequest("invalid concept (필수 필드 확인)");
    await upsertConcept(pool, examKey, b.concept, lang, b.ord);
  } else {
    throw badRequest("unknown type");
  }

  revalidateExam(examKey);
  return noContent();
});

export const DELETE = withAdmin(async (req) => {
  const b = await readJson(req);
  const { examKey, type } = b;
  if (typeof examKey !== "string" || !examKey) throw badRequest("examKey required");

  if (type === "question") {
    if (typeof b.qn !== "number") throw badRequest("qn required");
    await deleteQuestion(pool, examKey, b.qn);
  } else if (type === "concept") {
    if (typeof b.svc !== "string" || !b.svc) throw badRequest("svc required");
    await deleteConcept(pool, examKey, b.svc);
  } else {
    throw badRequest("unknown type");
  }

  revalidateExam(examKey);
  return noContent();
});
