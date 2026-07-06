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
// 세션 해석기 — 검증된 Learner 세션 또는 null(게이팅 없음). API 라우트는 withLearner, RSC 는
// requireLearnerPage(lib/route-guards)가 이걸 감싸 게이팅한다. (learner)/page.tsx 처럼 게이팅 없이
// 익명/Learner 조건부 렌더에만 필요한 곳은 이 해석기를 직접 쓴다.
export async function getLearnerSession(reqHeaders: Headers): Promise<LearnerSession | null> {
  const session = await auth.api.getSession({ headers: reqHeaders });
  return isLearner(session) ? (session as unknown as LearnerSession) : null;
}
