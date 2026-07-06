import { withLearner, readJson, badRequest, noContent } from "@/lib/route-guards";
import { pool } from "@/lib/db";
import type { Progress } from "@/lib/progress";
import { postgresProgressStore } from "@/lib/progress-store-postgres";

// Progress 동기화 Route Handler (이슈 #7 / ADR-0003).
//
// 얇은 핸들러 = 인가 + postgresProgressStore 위임. learner_id 는 항상 세션에서 해석한다(withLearner)
// — client 가 절대 learner_id 를 정하지 못하므로 타인 (learner_id, exam_key) 접근이 구조적으로
// 차단된다. 미인증·미검증 요청은 401. (exam_key 만 client 가 보낸다.)
//
// pg 어댑터는 node 런타임 필요(edge 불가). 매 요청 평가되도록 동적으로 둔다.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/progress?exam=<exam_key> — 세션 Learner 의 해당 Exam snapshot 봉투(없으면 null).
export const GET = withLearner(async (req, learnerId) => {
  const exam = new URL(req.url).searchParams.get("exam");
  if (!exam) throw badRequest("missing exam");

  const stored = await postgresProgressStore(pool, learnerId).load(exam);
  return Response.json(stored); // 봉투 또는 null
});

// PUT /api/progress  body: { exam, snapshot, updatedAt } — 세션 Learner 로 스코프해 upsert.
export const PUT = withLearner(async (req, learnerId) => {
  const { exam, snapshot, updatedAt } = await readJson(req);
  if (
    typeof exam !== "string" ||
    !exam ||
    typeof updatedAt !== "number" ||
    typeof snapshot !== "object" ||
    snapshot === null ||
    Array.isArray(snapshot) // 봉투 계약: snapshot 은 Progress 객체. 배열은 거절.
  ) {
    throw badRequest("invalid body");
  }

  await postgresProgressStore(pool, learnerId).save(exam, snapshot as Progress, updatedAt);
  return noContent();
});
