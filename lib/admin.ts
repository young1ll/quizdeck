// admin 권한 술어 — 순수(클라-안전) 절반 (ADR-0012 결정 10 / 아키텍처 리뷰 auth-coherence).
// 서버 절반 lib/admin-server.ts(getAdminSession, auth=pg 의존)와 대칭이되, 이 술어는 클라(exam 맥락
// 헤더의 '이 시험 편집'·/me 의 '어드민' 조건부 렌더)에서도 쓰여 서버 전용 lib/auth 를 끌면 클라 번들이
// 깨진다. learner.ts(순수) / learner-server.ts(서버) 와 **정확히 같은 네이밍 규칙** — bare=순수,
// -server=서버. 정규 규칙 = user.role 이 'admin' 포함(better-auth admin 플러그인 adminRoles 기본값 ["admin"]).

/** role 문자열이 admin 을 포함하는가. 단일 role 이 기본이나 콤마 다중 role 도 안전 처리. */
export function isAdminRole(role: string | null | undefined): boolean {
  return !!role && role.split(",").map((r) => r.trim()).includes("admin");
}

/**
 * role 이 CMS(Payload admin) 접근 가능한가 (ADR-0024). admin = 전체 운영 + CMS, author = 콘텐츠
 * 저작 전용(비개발자 작성자) — better-auth admin API(밴·롤 변경)는 여전히 admin 만 통과한다.
 * isAdminRole 과 같은 콤마 다중 role 규칙.
 */
export function isCmsRole(role: string | null | undefined): boolean {
  if (!role) return false;
  const roles = role.split(",").map((r) => r.trim());
  return roles.includes("admin") || roles.includes("author");
}

/**
 * 세션이 admin 의 것인가. 순수 — 클라(useSession)·서버(getSession) 가 공유한다. 클라 세션 타입엔 role 이
 * 안 실려(admin 플러그인 미타이핑) 있으나 런타임엔 있으므로 unknown 으로 받아 내부에서 좁힌다.
 */
export function isAdminSession(session: unknown): boolean {
  const role = (session as { user?: { role?: string | null } | null } | null | undefined)?.user
    ?.role;
  return isAdminRole(role);
}
