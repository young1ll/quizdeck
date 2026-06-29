import { revalidatePath } from "next/cache";
import { pool } from "@/lib/db";
import { getAdminSession } from "@/lib/admin";
import type { Concept, Question } from "@/lib/types";
import {
  upsertQuestion,
  upsertConcept,
  deleteQuestion,
  deleteConcept,
} from "@/lib/content-db";

// 콘텐츠 변경 API (이슈 #27 / ADR-0005 B). admin role 만 통과(getAdminSession). 저장/삭제 후
// 해당 Exam 경로를 revalidatePath 로 무효화해 ISR 캐시를 즉시 갱신한다(편집 즉시반영).
// 비admin·미인증은 403 — 콘텐츠 변경을 구조적으로 차단한다.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bad(msg: string): Response {
  return new Response(msg, { status: 400 });
}

// trailingSlash:true 환경이라 라우트 경로의 슬래시 유무가 갈린다 — 양쪽을 무효화해
// ISR 캐시 silent miss 를 막는다(편집 즉시반영 보장).
function revalidateExam(examKey: string): void {
  revalidatePath(`/${examKey}`);
  revalidatePath(`/${examKey}/`);
}

// 정답 글자 ⊂ options 키 + 필수 필드 + 타입(실 경계 검증, global §9). (answer 가 컬럼인 이유 — ADR-0005 결정 7)
function isValidQuestion(q: unknown): q is Question {
  if (typeof q !== "object" || q === null) return false;
  const o = q as Record<string, unknown>;
  if (typeof o.qn !== "number" || !Number.isInteger(o.qn) || o.qn <= 0) return false; // PK
  if (typeof o.q !== "string" || !o.q.trim()) return false;
  if (typeof o.topic !== "string") return false;
  if (typeof o.options !== "object" || o.options === null || Array.isArray(o.options)) return false;
  const opts = o.options as Record<string, unknown>;
  const optKeys = Object.keys(opts);
  if (optKeys.length === 0) return false;
  if (!optKeys.every((k) => typeof opts[k] === "string")) return false; // 보기 값은 문자열
  if (!Array.isArray(o.answer) || o.answer.length === 0) return false;
  return (o.answer as unknown[]).every((a) => typeof a === "string" && optKeys.includes(a));
}

function isValidConcept(c: unknown): c is Concept {
  if (typeof c !== "object" || c === null) return false;
  const o = c as Record<string, unknown>;
  const required = ["cat", "svc", "deff", "key", "when", "trap", "vs"];
  return required.every((f) => typeof o[f] === "string" && (o[f] as string).length > 0);
}

export async function PUT(req: Request): Promise<Response> {
  // 미인증·비admin 모두 403(균일) — 인증 상태/관리 표면 존재를 드러내지 않는다(progress 의 401 과 의도적 차이).
  if (!(await getAdminSession(req.headers))) return new Response("forbidden", { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return bad("bad json");
  }
  const b = (body ?? {}) as Record<string, unknown>;
  const { examKey, lang, type } = b;
  if (typeof examKey !== "string" || !examKey || typeof lang !== "string" || !lang) {
    return bad("examKey/lang required");
  }

  if (type === "question") {
    if (!isValidQuestion(b.question)) return bad("invalid question (정답 ⊂ options·필수 필드 확인)");
    await upsertQuestion(pool, examKey, b.question, lang);
  } else if (type === "concept") {
    if (typeof b.ord !== "number") return bad("ord required");
    if (!isValidConcept(b.concept)) return bad("invalid concept (필수 필드 확인)");
    await upsertConcept(pool, examKey, b.concept, lang, b.ord);
  } else {
    return bad("unknown type");
  }

  revalidateExam(examKey);
  return new Response(null, { status: 204 });
}

export async function DELETE(req: Request): Promise<Response> {
  if (!(await getAdminSession(req.headers))) return new Response("forbidden", { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return bad("bad json");
  }
  const b = (body ?? {}) as Record<string, unknown>;
  const { examKey, type } = b;
  if (typeof examKey !== "string" || !examKey) return bad("examKey required");

  if (type === "question") {
    if (typeof b.qn !== "number") return bad("qn required");
    await deleteQuestion(pool, examKey, b.qn);
  } else if (type === "concept") {
    if (typeof b.svc !== "string" || !b.svc) return bad("svc required");
    await deleteConcept(pool, examKey, b.svc);
  } else {
    return bad("unknown type");
  }

  revalidateExam(examKey);
  return new Response(null, { status: 204 });
}
