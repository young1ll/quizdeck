import { auth } from "./auth";
import { isLearner, type LearnerSession } from "./learner";

// Learner 신원 경계 — 서버 절반 (ADR-0004 애던덤 / 아키텍처 리뷰 C1). 세션 해석은 lib/auth(=pg,
// better-auth 서버)에 의존하므로 클라-안전한 술어(lib/learner)와 갈라 둔다 — 이 파일은 서버
// (Route Handler·RSC)에서만 import 한다. admin 의 getAdminSession 과 대칭.
//
// 서버도 emailVerified 를 직접 확인한다(isLearner) — session-존재로 단순화하지 말 것. 클라 게이트와
// 규칙이 갈라지는 드리프트 방지이자 설정 변경에 대한 defense-in-depth(의도된 중복, ADR-0004 애던덤).

/**
 * 요청 헤더에서 세션을 해석해 검증된 Learner 면 반환, 아니면 null. 헤더 주입식이라 Route Handler
 * (`req.headers`)와 Server Component(`await headers()`) 양쪽에서 쓰고 테스트도 쉽다. (admin 대칭)
 */
export async function getLearnerSession(reqHeaders: Headers): Promise<LearnerSession | null> {
  const session = await auth.api.getSession({ headers: reqHeaders });
  return isLearner(session) ? (session as unknown as LearnerSession) : null;
}

/**
 * API 라우트용 — 검증된 Learner 면 learner_id(string), 아니면 401 Response. 호출부는
 * `const id = await requireLearner(req); if (id instanceof Response) return id;` 한 줄로 가드한다.
 * 5곳에 복붙됐던 401 을 한 주인으로 수렴한다(상태·본문·향후 감사/레이트리밋의 단일 정의).
 */
export async function requireLearner(req: Request): Promise<string | Response> {
  const session = await getLearnerSession(req.headers);
  if (!session) return new Response("unauthorized", { status: 401 });
  return session.user.id;
}
