import type { Access } from "payload";

// Payload 컬렉션 접근 술어 (ADR-0024). 인증은 auth-strategy(better-auth 세션)가 끝냈고,
// 여기선 미러 문서(cms-users)의 role 로만 가른다 — admin = 운영 전체, author = 콘텐츠 저작.

/** CMS 로그인된 사용자(admin|author) — 콘텐츠 컬렉션의 기본 게이트. */
export const cmsUser: Access = ({ req }) => Boolean(req.user);

/** admin 만 — 파괴적 조작(문제집 삭제, cms-users 관리)용. */
export const adminOnly: Access = ({ req }) =>
  (req.user as { role?: string } | null)?.role === "admin";

/** 본인 문서 또는 admin — cms-users 조회(admin 패널 /me 경로가 자기 문서를 읽는다). */
export const selfOrAdmin: Access = ({ req }) => {
  const user = req.user as { id?: number | string; role?: string } | null;
  if (!user) return false;
  if (user.role === "admin") return true;
  return { id: { equals: user.id } };
};
