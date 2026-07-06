import type { Pool } from "pg";
import { isAdminRole } from "./admin";

// 관리자 사용자 목록 (아키텍처 리뷰 admin-hub / ADR-0017). **읽기전용** — User 축(계정) 조회.
// 관리(ban·역할 변경·세션 해지·삭제)는 호스티드 Better Auth 대시보드에 위임한다(미리 사지 않음).
// /me 의 loadAllProgress 처럼 RSC 가 user 테이블을 직접 읽는다(새 API 없음). role 판정은 순수
// isAdminRole(lib/admin) 재사용 — 콘텐츠 인가와 같은 규칙.

// emailVerified === true 가 곧 Learner(CONTEXT.md 경계) — 목록이 User→Learner 구분을 드러낸다.
export interface AdminUser {
  id: string;
  email: string;
  name: string;
  verified: boolean; // true = Learner, false = 미인증 가입자
  isAdmin: boolean;
  joined: string; // 'YYYY-MM-DD'(UTC) — 가입일
}

interface UserRow {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  role: string | null;
  createdAt: Date;
}

/** 전 사용자(가입일 desc). better-auth user 테이블 직접 조회 — 서버 전용(pg). */
export async function loadUsers(pool: Pool): Promise<AdminUser[]> {
  const r = await pool.query<UserRow>(
    `select "id", "email", "name", "emailVerified", "role", "createdAt"
       from "user" order by "createdAt" desc`,
  );
  return r.rows.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    verified: u.emailVerified,
    isAdmin: isAdminRole(u.role),
    joined: u.createdAt.toISOString().slice(0, 10),
  }));
}

export interface UserSummary {
  total: number;
  verified: number; // = Learner 수
  admins: number;
}

/** 목록 요약(전체·검증(Learner)·admin). 순수 — DB 없이 테스트된다. */
export function summarizeUsers(users: AdminUser[]): UserSummary {
  return {
    total: users.length,
    verified: users.filter((u) => u.verified).length,
    admins: users.filter((u) => u.isAdmin).length,
  };
}
