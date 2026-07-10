import type { AuthStrategy } from "payload";
import { isAdminRole, isCmsRole } from "../lib/admin.ts";

// better-auth 세션을 신뢰하는 Payload 커스텀 인증 전략 (ADR-0024). Payload 로컬 인증(비밀번호)은
// 끄고(cms-users.auth.disableLocalStrategy), 계정 체계를 better-auth 하나로 유지한다 — admin 권한
// 경계(user.role, ADR-0005 B)의 계승. role ∈ {admin, author} 세션만 통과하고, 통과한 사용자는
// cms-users 미러 문서로 구체화한다(Payload 가 req.user 로 쓸 문서가 필요하다 — 인증의 소스는
// 어디까지나 better-auth 세션이고 미러는 role 스냅샷일 뿐).

const STRATEGY_NAME = "quizdeck-better-auth";

/** better-auth 다중 role 문자열 → cms-users.role 스냅샷. admin 이 하나라도 있으면 admin. */
function toCmsRole(role: string | null | undefined): "admin" | "author" {
  return isAdminRole(role) ? "admin" : "author";
}

export const betterAuthStrategy: AuthStrategy = {
  name: STRATEGY_NAME,
  authenticate: async ({ payload, headers }) => {
    // 동적 import — better-auth(pg·email 의존) 초기화를 요청 시점으로 미룬다. payload CLI
    // (generate:*·migrate)가 config 를 로드할 때 이 체인을 실행하지 않게 하는 경계.
    const { auth } = await import("@/lib/auth");
    const session = await auth.api.getSession({ headers });
    const su = session?.user as
      | { id: string; email: string; name?: string | null; role?: string | null }
      | undefined;
    if (!su || !isCmsRole(su.role)) return { user: null };

    const role = toCmsRole(su.role);
    const found = await payload.find({
      collection: "cms-users",
      where: { authUserId: { equals: su.id } },
      limit: 1,
      overrideAccess: true,
    });

    let doc = found.docs[0];
    if (!doc) {
      doc = await payload.create({
        collection: "cms-users",
        data: { authUserId: su.id, email: su.email, name: su.name ?? "", role },
        overrideAccess: true,
      });
    } else if (doc.role !== role || doc.email !== su.email) {
      // role 강등/승격·이메일 변경을 다음 요청에서 미러에 반영 — 세션이 항상 진실이다.
      doc = await payload.update({
        collection: "cms-users",
        id: doc.id,
        data: { email: su.email, role },
        overrideAccess: true,
      });
    }

    return {
      user: {
        ...doc,
        collection: "cms-users" as const,
        _strategy: STRATEGY_NAME,
      },
    };
  },
};
