import { auth } from "./auth";

// admin 권한 경계 (이슈 #27 / ADR-0005 B). /admin 페이지·콘텐츠 변경 API 가 공유한다.
// better-auth admin 플러그인의 adminRoles 기본값은 ["admin"] — user.role 이 'admin' 이어야 통과.
// 첫 admin 은 DB 에서 수동 지정한다(0004_admin.sql 주석).

/** role 문자열이 admin 을 포함하는가. 단일 role 이 기본이나 콤마 다중 role 도 안전 처리. */
export function isAdminRole(role: string | null | undefined): boolean {
  return !!role && role.split(",").map((r) => r.trim()).includes("admin");
}

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
