import { withLearner, readJson, badRequest, noContent } from "@/lib/route-guards";
import { pool } from "@/lib/db";
import { parseCollection } from "@/lib/collection";
import { deleteCollection, listCollections, upsertCollection } from "@/lib/collection-db";

// 컬렉션 Route Handler (ADR-0022). annotations 라우트와 같은 형태 — 얇은 핸들러 = withLearner 인가 +
// DB 위임. learner_id 는 항상 세션에서(withLearner) 해석하므로 client 가 절대 못 정하고 타인 컬렉션
// 접근이 구조적으로 차단된다. 경계 검증(parseCollection)은 lib/collection(도메인)이 소유. 컬렉션은
// cross-Exam 엔티티라 exam 파라미터가 없다(전 시험을 가로지르는 목록).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/collections — 세션 Learner 의 컬렉션 전부(최근 갱신순).
export const GET = withLearner(async (_req, learnerId) => {
  return Response.json(await listCollections(pool, learnerId));
});

// PUT /api/collections  body: { collection } — 세션 Learner 로 스코프해 upsert(생성·이름변경·담기/빼기).
export const PUT = withLearner(async (req, learnerId) => {
  const { collection } = await readJson(req);
  const c = parseCollection(collection);
  if (!c) throw badRequest("invalid collection");
  await upsertCollection(pool, learnerId, c);
  return noContent();
});

// DELETE /api/collections?id=<id> — 세션 Learner 스코프 삭제.
export const DELETE = withLearner(async (req, learnerId) => {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) throw badRequest("missing id");
  await deleteCollection(pool, learnerId, id);
  return noContent();
});
