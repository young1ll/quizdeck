"use client";
import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

// 사용자 행 액션 (ADR-0024 확장 B / ADR-0017 재개봉). better-auth admin API 를 같은 오리진
// fetch 로 호출한다 — 세션 쿠키가 자격증명이고 서버(admin 플러그인)가 admin role 을 재검증한다
// (이 UI 는 편의 표면일 뿐 보안 경계가 아니다). 성공 시 router.refresh() 로 서버 표를 재조회.

const ROLES = ["user", "author", "admin"] as const;

async function call(path: string, body: Record<string, unknown>): Promise<string | null> {
  const res = await fetch(`/api/auth/admin/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.ok) return null;
  const j = (await res.json().catch(() => null)) as { message?: string } | null;
  return j?.message ?? `${res.status}`;
}

export default function UserActions({
  userId,
  role,
  banned,
  isSelf,
}: {
  userId: string;
  role: string;
  banned: boolean;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<string | null>) =>
    start(async () => {
      setError(await fn());
      router.refresh();
    });

  if (isSelf) return <span style={{ opacity: 0.5, fontSize: "0.8rem" }}>본인</span>;

  return (
    <span style={{ display: "inline-flex", gap: "0.4rem", alignItems: "center" }}>
      <select
        value={ROLES.includes(role as (typeof ROLES)[number]) ? role : "user"}
        disabled={pending}
        onChange={(e) => run(() => call("set-role", { userId, role: e.target.value }))}
        aria-label="롤 변경"
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          banned
            ? run(() => call("unban-user", { userId }))
            : window.confirm("이 사용자를 밴할까요? 세션이 즉시 무효화됩니다.") &&
              run(() => call("ban-user", { userId }))
        }
      >
        {banned ? "밴 해제" : "밴"}
      </button>
      {error && <span style={{ color: "var(--theme-error-500, #d33)", fontSize: "0.75rem" }}>{error}</span>}
    </span>
  );
}
