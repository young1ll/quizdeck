// Learner 신원 술어 — 순수(클라-안전) 절반 (ADR-0004 애던덤 / 아키텍처 리뷰 C1·auth-coherence).
// admin 술어(lib/admin)와 **같은 네이밍 규칙**(bare=순수, -server=서버). 술어는 클라(ExamApp 게이트·
// store 선택)에서도 쓰여 서버 전용 lib/auth(=pg) 를 끌면 클라 번들이 깨지므로 여기(순수, auth 무의존)에
// 두고, 세션 해석(getLearnerSession)은 lib/learner-server 로 가른다(admin.ts ↔ admin-server.ts 대칭).
//
// 정규 술어 = emailVerified === true. "이 세션은 Learner 인가"를 한 곳에서 정의한다(그 전엔 5곳에
// emailVerified vs id-존재 두 규칙으로 흩어져 있었다). CONTEXT.md: Learner = 이메일 검증된 신원.

type SessionLike = { user?: { id?: string | null; emailVerified?: boolean | null } | null } | null | undefined;

/** 세션이 검증된 Learner 의 것인가. 순수 — 클라(useSession)·서버(getSession) 가 공유한다. */
export function isLearner(session: SessionLike): boolean {
  return session?.user?.emailVerified === true;
}

/** Learner 면 그 id, 아니면 null. 'id 는 검증될 때만' 불변식을 모듈에 둔다(클라 store 선택용). */
export function learnerId(session: SessionLike): string | null {
  return isLearner(session) ? (session?.user?.id ?? null) : null;
}

export interface LearnerSession {
  user: { id: string; email: string; name: string; emailVerified: boolean };
}
