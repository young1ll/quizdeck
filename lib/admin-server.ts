import { auth } from "./auth";
import { isAdminRole } from "./admin";

// admin 권한 경계 — 서버 절반 (이슈 #27 / ADR-0005 B · 아키텍처 리뷰 auth-coherence). /admin 페이지·
// 콘텐츠 변경 API 가 공유한다. better-auth admin 플러그인의 adminRoles 기본값은 ["admin"] — user.role 이
// 'admin' 이어야 통과. 첫 admin 은 DB 에서 수동 지정한다(0004_admin.sql 주석). 순수 술어(isAdminRole·
// isAdminSession)는 클라-안전 lib/admin 에 있다 — 클라는 거기서 직접 import(서버 모듈 경유하면 pg 를 끎).
// learner-server.ts(순수 learner.ts 대칭)와 같은 결.

export interface AdminSession {
  user: { id: string; email: string; name?: string | null; role?: string | null };
}

/**
 * 요청 헤더에서 세션을 해석해 admin 이면 반환, 아니면 null. 헤더 주입식이라 Route Handler
 * (`req.headers`)와 Server Component(`await headers()`) 양쪽에서 쓰고 테스트도 쉽다.
 */
export async function getAdminSession(reqHeaders: Headers): Promise<AdminSession | null> {
  const session = await auth.api.getSession({ headers: reqHeaders });
  const role = (session?.user as { role?: string | null } | undefined)?.role;
  return session && isAdminRole(role) ? (session as unknown as AdminSession) : null;
}
