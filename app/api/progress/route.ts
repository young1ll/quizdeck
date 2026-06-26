import { auth } from "@/lib/auth";
import { pool } from "@/lib/db";
import type { Progress } from "@/lib/progress";
import { postgresProgressStore } from "@/lib/progress-store-postgres";

// Progress 동기화 Route Handler (이슈 #7 / ADR-0003).
//
// 얇은 핸들러 = 인가 + postgresProgressStore 위임. learner_id 는 항상 better-auth 세션에서
// 해석한다 — client 가 절대 learner_id 를 정하지 못하므로 타인 (learner_id, exam_key) 접근이
// 구조적으로 차단된다. 미인증 요청은 401. (exam_key 만 client 가 보낸다.)
//
// pg 어댑터는 node 런타임 필요(edge 불가). 매 요청 평가되도록 동적으로 둔다.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 세션 → learner_id. 없으면 null(=미인증).
async function resolveLearnerId(req: Request): Promise<string | null> {
  const session = await auth.api.getSession({ headers: req.headers });
  return session?.user?.id ?? null;
}

// GET /api/progress?exam=<exam_key> — 세션 Learner 의 해당 Exam snapshot 봉투(없으면 null).
export async function GET(req: Request): Promise<Response> {
  const learnerId = await resolveLearnerId(req);
  if (!learnerId) return new Response("unauthorized", { status: 401 });

  const exam = new URL(req.url).searchParams.get("exam");
  if (!exam) return new Response("missing exam", { status: 400 });

  const stored = await postgresProgressStore(pool, learnerId).load(exam);
  return Response.json(stored); // 봉투 또는 null
}

// PUT /api/progress  body: { exam, snapshot, updatedAt } — 세션 Learner 로 스코프해 upsert.
export async function PUT(req: Request): Promise<Response> {
  const learnerId = await resolveLearnerId(req);
  if (!learnerId) return new Response("unauthorized", { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("bad json", { status: 400 });
  }
  const { exam, snapshot, updatedAt } = (body ?? {}) as {
    exam?: unknown;
    snapshot?: unknown;
    updatedAt?: unknown;
  };
  if (
    typeof exam !== "string" ||
    !exam ||
    typeof updatedAt !== "number" ||
    typeof snapshot !== "object" ||
    snapshot === null ||
    Array.isArray(snapshot) // 봉투 계약: snapshot 은 Progress 객체. 배열은 거절.
  ) {
    return new Response("invalid body", { status: 400 });
  }

  await postgresProgressStore(pool, learnerId).save(exam, snapshot as Progress, updatedAt);
  return new Response(null, { status: 204 });
}
