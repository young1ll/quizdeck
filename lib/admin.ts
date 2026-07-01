import { auth } from "./auth";
import { isAdminRole } from "./admin-role";

// admin 권한 경계 — 서버 절반 (이슈 #27 / ADR-0005 B). /admin 페이지·콘텐츠 변경 API 가 공유한다.
// better-auth admin 플러그인의 adminRoles 기본값은 ["admin"] — user.role 이 'admin' 이어야 통과.
// 첫 admin 은 DB 에서 수동 지정한다(0004_admin.sql 주석). 순수 술어 isAdminRole 은 클라-안전
// lib/admin-role 로 갈라 두고(ADR-0012 결정 10 — 맥락 헤더·/me 의 admin 진입 조건부 렌더) 재노출한다.
export { isAdminRole } from "./admin-role";

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
