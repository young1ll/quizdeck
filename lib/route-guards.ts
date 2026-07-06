import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { getLearnerSession } from "./learner-server";
import { getAdminSession, type AdminSession } from "./admin-server";
import type { LearnerSession } from "./learner";

// API/RSC 인가 seam (아키텍처 리뷰). "인증→거절+parse+error" 를 한 곳에. 옛날엔 라우트마다
// `requireLearner(req)` 의 string|Response 유니온을 `if (x instanceof Response) return x` 로 unwrap(5×)
// 했고 — 빠뜨리면 Response 가 learnerId 로 store 에 넘어가는 컴파일-통과 auth 우회였다 — admin 은
// requireAdmin 대칭이 없어 403 을 재인라인(2×)했다. 여기서 고차 래퍼로 뒤집는다: 래퍼가 세션을
// 해석해 실패면 401/403, 성공이면 핸들러를 **검증된 신원**으로 호출한다. 핸들러는 Response 를 절대
// 받지 않으므로 유니온·unwrap 이 사라지고, 신원 없이는 핸들러가 실행조차 안 돼 우회가 구조적으로 불가.
// parse/검증 실패는 Response 를 throw 하고 래퍼가 가로챈다 → 핸들러가 완전 선형(Next 가 RSC 에서
// redirect/notFound 를 throw 로 쓰는 것과 같은 결). 게이팅 정책(401/403/redirect/notFound)의 단일 주인.

// ── Response 헬퍼 (상태·본문의 단일 정의) ────────────────────────────
export const unauthorized = () => new Response("unauthorized", { status: 401 });
export const forbidden = () => new Response("forbidden", { status: 403 });
export const badRequest = (msg = "bad request") => new Response(msg, { status: 400 });
export const noContent = () => new Response(null, { status: 204 });

/** 요청 body 를 JSON 으로 읽는다 — 파싱 실패면 400 Response 를 throw(래퍼가 가로챈다). */
export async function readJson(req: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw badRequest("bad json");
  }
  return (body ?? {}) as Record<string, unknown>;
}

// ── API 라우트 고차 래퍼 ─────────────────────────────────────────────
type LearnerHandler = (req: Request, learnerId: string) => Promise<Response>;
type AdminHandler = (req: Request, admin: AdminSession) => Promise<Response>;

/** 검증된 Learner 면 핸들러를 learner_id 로 호출, 아니면 401. 핸들러가 throw 한 Response 를 가로챈다. */
export function withLearner(handler: LearnerHandler): (req: Request) => Promise<Response> {
  return async (req) => {
    const session = await getLearnerSession(req.headers);
    if (!session) return unauthorized();
    try {
      return await handler(req, session.user.id);
    } catch (e) {
      if (e instanceof Response) return e;
      throw e;
    }
  };
}

/** admin 이면 핸들러를 세션으로 호출, 아니면 403(미인증·비admin 균일 — 관리 표면 존재를 안 드러냄). */
export function withAdmin(handler: AdminHandler): (req: Request) => Promise<Response> {
  return async (req) => {
    const admin = await getAdminSession(req.headers);
    if (!admin) return forbidden();
    try {
      return await handler(req, admin);
    } catch (e) {
      if (e instanceof Response) return e;
      throw e;
    }
  };
}

// ── RSC 페이지 가드 (redirect/notFound 는 Next 가 throw 로 처리) ───────
/** RSC — 검증된 Learner 세션을 반환, 아니면 홈으로 redirect. */
export async function requireLearnerPage(): Promise<LearnerSession> {
  const session = await getLearnerSession(await headers());
  if (!session) redirect("/");
  return session;
}

/** RSC — admin 세션을 반환, 아니면 notFound(관리 표면 존재를 안 드러냄). */
export async function requireAdminPage(): Promise<AdminSession> {
  const session = await getAdminSession(await headers());
  if (!session) notFound();
  return session;
}
