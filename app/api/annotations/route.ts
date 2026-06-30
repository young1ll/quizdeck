import { requireLearner } from "@/lib/learner-server";
import { pool } from "@/lib/db";
import type { Annotation } from "@/lib/annotation";
import {
  deleteAnnotation,
  listAnnotations,
  upsertAnnotation,
} from "@/lib/annotation-db";

// 주석 동기화 Route Handler (이슈 #29 / ADR-0005 D). 진행(#7) 라우트와 같은 형태 — 얇은 핸들러 =
// 인가 + DB 위임. learner_id 는 항상 세션에서 해석하므로(requireLearner, client 가 절대 못 정함) 타인
// (learner_id) 주석 접근이 구조적으로 차단된다. 미인증·미검증은 401. (exam_key·id 만 client 가 보낸다.)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 경계 검증 — 타입을 확정한다(SQL 은 파라미터화라 주입 불가, 형태만 막는다).
function parseAnnotation(v: unknown): Annotation | null {
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  const anchor = o.anchor as Record<string, unknown> | null | undefined;
  if (
    typeof o.id !== "string" ||
    !o.id ||
    typeof o.qn !== "number" ||
    !Number.isInteger(o.qn) ||
    typeof o.lang !== "string" ||
    !o.lang ||
    typeof o.field !== "string" ||
    !o.field ||
    (o.kind !== "underline" && o.kind !== "highlight") ||
    (o.memo != null && typeof o.memo !== "string") ||
    typeof anchor !== "object" ||
    anchor === null ||
    typeof anchor.quote !== "string" ||
    typeof anchor.prefix !== "string" ||
    typeof anchor.suffix !== "string"
  ) {
    return null;
  }
  return {
    id: o.id,
    qn: o.qn,
    lang: o.lang,
    field: o.field,
    kind: o.kind,
    memo: (o.memo as string | undefined) ?? null,
    anchor: { quote: anchor.quote, prefix: anchor.prefix, suffix: anchor.suffix },
  };
}

// GET /api/annotations?exam=<exam_key> — 세션 Learner 의 해당 Exam 주석 전부(배열).
export async function GET(req: Request): Promise<Response> {
  const learnerId = await requireLearner(req);
  if (learnerId instanceof Response) return learnerId;

  const exam = new URL(req.url).searchParams.get("exam");
  if (!exam) return new Response("missing exam", { status: 400 });

  return Response.json(await listAnnotations(pool, learnerId, exam));
}

// PUT /api/annotations  body: { exam, annotation } — 세션 Learner 로 스코프해 upsert.
export async function PUT(req: Request): Promise<Response> {
  const learnerId = await requireLearner(req);
  if (learnerId instanceof Response) return learnerId;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("bad json", { status: 400 });
  }
  const { exam, annotation } = (body ?? {}) as { exam?: unknown; annotation?: unknown };
  if (typeof exam !== "string" || !exam) {
    return new Response("invalid body", { status: 400 });
  }
  const a = parseAnnotation(annotation);
  if (!a) return new Response("invalid annotation", { status: 400 });

  await upsertAnnotation(pool, learnerId, exam, a);
  return new Response(null, { status: 204 });
}

// DELETE /api/annotations?id=<id> — 세션 Learner 스코프 삭제.
export async function DELETE(req: Request): Promise<Response> {
  const learnerId = await requireLearner(req);
  if (learnerId instanceof Response) return learnerId;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return new Response("missing id", { status: 400 });

  await deleteAnnotation(pool, learnerId, id);
  return new Response(null, { status: 204 });
}
