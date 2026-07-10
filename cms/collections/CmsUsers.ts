import type { CollectionConfig } from "payload";
import { betterAuthStrategy } from "../auth-strategy.ts";
import { adminOnly, selfOrAdmin } from "../access.ts";

// better-auth 세션 미러 (ADR-0024). Payload 가 인증 주체로 쓸 문서 컬렉션 — 직접 생성/편집하지
// 않는다(auth-strategy 가 세션에서 find-or-create·동기화). 비밀번호 컬럼 없음(로컬 인증 OFF).
export const CmsUsers: CollectionConfig = {
  slug: "cms-users",
  auth: {
    disableLocalStrategy: true,
    strategies: [betterAuthStrategy],
  },
  admin: {
    useAsTitle: "email",
    description:
      "better-auth 세션 미러 — 직접 만들지 않는다. 접근 부여는 user.role 에 admin|author 지정.",
    hidden: ({ user }) => (user as { role?: string } | null)?.role !== "admin",
  },
  access: {
    read: selfOrAdmin,
    create: () => false, // 전략만 생성(overrideAccess) — 패널/REST 생성 금지
    update: () => false, // 전략만 role/email 동기화 — 수동 편집은 다음 요청에 덮인다
    delete: adminOnly,
  },
  fields: [
    {
      name: "authUserId",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: { readOnly: true, description: 'better-auth "user".id' },
    },
    { name: "email", type: "text", required: true, admin: { readOnly: true } },
    { name: "name", type: "text", admin: { readOnly: true } },
    {
      name: "role",
      type: "select",
      options: ["admin", "author"],
      required: true,
      defaultValue: "author",
      admin: { readOnly: true, description: "better-auth user.role 스냅샷 — 세션이 진실" },
    },
  ],
};
