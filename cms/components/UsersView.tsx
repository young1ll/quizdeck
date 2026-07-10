import React from "react";
import type { AdminViewServerProps } from "payload";
import { DefaultTemplate } from "@payloadcms/next/templates";
import { Gutter } from "@payloadcms/ui";
import { pool } from "../../lib/db.ts";
import { isAdminRole } from "../../lib/admin.ts";
import UserActions from "./UserActions.tsx";

// 사용자 관리 커스텀 뷰 (ADR-0024 확장 B — ADR-0017 부분 재개봉). better-auth "user"(public
// 스키마)를 직접 읽어 목록·검색 없이 최근순으로 보여주고, 밴/롤 변경은 UserActions(클라이언트)가
// better-auth admin API 로. 계정 삭제·세션 강제 종료 등 나머지 파괴 조작은 여전히 hosted
// 대시보드 소유(전면 재구현이 아니라 고빈도 조작 2종만 인앱화). **admin 전용** — author 는
// 콘텐츠 저작 경계 밖(ADR-0024 결정 4).

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  role: string | null;
  banned: boolean | null;
  emailVerified: boolean;
  createdAt: Date;
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "0.5rem 0.75rem",
  borderBottom: "1px solid var(--theme-elevation-200)",
  fontSize: "0.75rem",
  color: "var(--theme-elevation-600)",
};
const td: React.CSSProperties = {
  padding: "0.5rem 0.75rem",
  borderBottom: "1px solid var(--theme-elevation-100)",
  fontSize: "0.85rem",
};

export default async function UsersView({ initPageResult, params, searchParams }: AdminViewServerProps) {
  const me = initPageResult.req.user as { email?: string; role?: string } | null;

  let body: React.ReactNode;
  if (!isAdminRole(me?.role)) {
    body = <p>이 화면은 admin 전용입니다 — author 계정은 콘텐츠만 관리할 수 있습니다.</p>;
  } else {
    const r = await pool.query<UserRow>(
      `select "id", "email", "name", "role", "banned", "emailVerified", "createdAt"
         from "user" order by "createdAt" desc limit 200`,
    );
    body = (
      <>
        <p style={{ color: "var(--theme-elevation-600)", fontSize: "0.85rem" }}>
          최근 가입순 {r.rows.length}명 · 롤 변경·밴은 즉시 반영(better-auth admin API). 계정
          삭제·세션 관리는{" "}
          <a href="https://dash.better-auth.com" target="_blank" rel="noreferrer">
            인증 대시보드 ↗
          </a>
        </p>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th style={th}>이메일</th>
              <th style={th}>이름</th>
              <th style={th}>가입</th>
              <th style={th}>상태</th>
              <th style={th}>롤 · 밴</th>
            </tr>
          </thead>
          <tbody>
            {r.rows.map((u) => (
              <tr key={u.id}>
                <td style={td}>{u.email}</td>
                <td style={td}>{u.name ?? "—"}</td>
                <td style={td}>{u.createdAt.toISOString().slice(0, 10)}</td>
                <td style={td}>
                  {u.banned ? "🚫 밴" : u.emailVerified ? "✅" : "미인증"}
                </td>
                <td style={td}>
                  <UserActions
                    userId={u.id}
                    role={u.role ?? "user"}
                    banned={Boolean(u.banned)}
                    isSelf={u.email === me?.email}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    );
  }

  return (
    <DefaultTemplate
      i18n={initPageResult.req.i18n}
      locale={initPageResult.locale}
      params={params}
      payload={initPageResult.req.payload}
      permissions={initPageResult.permissions}
      searchParams={searchParams}
      user={initPageResult.req.user || undefined}
      visibleEntities={initPageResult.visibleEntities}
    >
      <Gutter>
        <h1 style={{ margin: "0.5rem 0 1rem" }}>사용자</h1>
        {body}
      </Gutter>
    </DefaultTemplate>
  );
}
