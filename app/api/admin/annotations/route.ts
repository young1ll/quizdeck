import { withServiceToken, readJson, badRequest, noContent } from "@/lib/route-guards";
import { pool } from "@/lib/db";
import { log } from "@/lib/log";
import {
  adminDeleteAnnotation,
  adminUpdateAnnotation,
  getLearnerSummary,
  listAnnotationsByLearner,
} from "@/lib/admin-annotation-db";

// wp-admin '회원 주석' 화면의 서버-서버 API (ADR-0027). withServiceToken 인가(공유 토큰, 세션 없음
// — 클러스터 내부 WP 만 호출) + DB 위임의 얇은 형태. 수정은 memo·kind 만 받는 id 기준 UPDATE 라
// anchor/field/qn 등 위치 정보는 이 API 로 절대 변형되지 않는다. 뮤테이션은 감사 로그 한 줄
// (actor = WP 로그인명 X-QD-Actor·annotationId — memo 원문은 프라이버시상 제외).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const actorOf = (req: Request) => (req.headers.get("x-qd-actor") ?? "unknown").slice(0, 64);

// GET /api/admin/annotations?learner=<id> — 회원 요약 + 그 회원의 주석 전부(exam_key·qn 정렬).
export const GET = withServiceToken(async (req) => {
  const learnerId = new URL(req.url).searchParams.get("learner");
  if (!learnerId) throw badRequest("missing learner");
  const learner = await getLearnerSummary(pool, learnerId);
  if (!learner) return new Response("not found", { status: 404 });
  return Response.json({ learner, annotations: await listAnnotationsByLearner(pool, learnerId) });
});

// PATCH /api/admin/annotations  body: { id, memo, kind } — memo/kind 두 필드 고정 전송(WP 폼이 현재값 보유).
export const PATCH = withServiceToken(async (req) => {
  const { id, memo, kind } = await readJson(req);
  if (typeof id !== "string" || !id) throw badRequest("missing id");
  if (kind !== "underline" && kind !== "highlight") throw badRequest("invalid kind");
  if (memo != null && typeof memo !== "string") throw badRequest("invalid memo");
  const ok = await adminUpdateAnnotation(pool, id, { memo: memo ?? null, kind });
  if (!ok) return new Response("not found", { status: 404 });
  log.info("admin 주석 수정", { actor: actorOf(req), via: "wp-admin", annotationId: id });
  return noContent();
});

// DELETE /api/admin/annotations?id=<id>
export const DELETE = withServiceToken(async (req) => {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) throw badRequest("missing id");
  const ok = await adminDeleteAnnotation(pool, id);
  if (!ok) return new Response("not found", { status: 404 });
  log.info("admin 주석 삭제", { actor: actorOf(req), via: "wp-admin", annotationId: id });
  return noContent();
});
