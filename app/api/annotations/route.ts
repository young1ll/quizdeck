import { withLearner, readJson, badRequest, noContent } from "@/lib/route-guards";
import { pool } from "@/lib/db";
import { parseAnnotation } from "@/lib/annotation";
import { deleteAnnotation, listAnnotations, upsertAnnotation } from "@/lib/annotation-db";

// 주석 동기화 Route Handler (이슈 #29 / ADR-0005 D). 진행(#7) 라우트와 같은 형태 — 얇은 핸들러 =
// withLearner 인가 + DB 위임. learner_id 는 항상 세션에서(withLearner) 해석하므로 client 가 절대 못 정하고
// 타인 주석 접근이 구조적으로 차단된다. 경계 검증(parseAnnotation)은 lib/annotation(도메인)이 소유.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/annotations?exam=<exam_key> — 세션 Learner 의 해당 Exam 주석 전부(배열).
export const GET = withLearner(async (req, learnerId) => {
  const exam = new URL(req.url).searchParams.get("exam");
  if (!exam) throw badRequest("missing exam");
  return Response.json(await listAnnotations(pool, learnerId, exam));
});

// PUT /api/annotations  body: { exam, annotation } — 세션 Learner 로 스코프해 upsert.
export const PUT = withLearner(async (req, learnerId) => {
  const { exam, annotation } = await readJson(req);
  if (typeof exam !== "string" || !exam) throw badRequest("invalid body");
  const a = parseAnnotation(annotation);
  if (!a) throw badRequest("invalid annotation");
  await upsertAnnotation(pool, learnerId, exam, a);
  return noContent();
});

// DELETE /api/annotations?id=<id> — 세션 Learner 스코프 삭제.
export const DELETE = withLearner(async (req, learnerId) => {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) throw badRequest("missing id");
  await deleteAnnotation(pool, learnerId, id);
  return noContent();
});
