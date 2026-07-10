import { requireAdminPage } from "@/lib/route-guards";
import { pool } from "@/lib/db";
import { loadUsers, summarizeUsers } from "@/lib/admin-users";

// 사용자 읽기전용 목록 (아키텍처 리뷰 admin-hub / ADR-0017). admin 게이트 + user 테이블 직접 조회.
// User 축(계정) 조회 — 검증(=Learner)·admin 배지가 User→Learner 경계를 드러낸다. 관리(ban·역할·
// 세션)는 호스티드 Better Auth 대시보드로 위임. 세션·DB 의존이라 동적, node 런타임.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AdminUsers() {
  await requireAdminPage();
  const users = await loadUsers(pool);
  const s = summarizeUsers(users);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold">사용자</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        전체 {s.total} · 검증(Learner) {s.verified} · admin {s.admins}. 관리(ban·역할·세션)는{" "}
        <a
          href="https://dash.better-auth.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--accent)] hover:underline"
        >
          Better Auth 대시보드
        </a>
        에서 합니다.
      </p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted)]">
              <th className="py-2 pr-3 font-medium">이메일</th>
              <th className="py-2 pr-3 font-medium">이름</th>
              <th className="py-2 pr-3 font-medium">상태</th>
              <th className="py-2 font-medium">가입</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-[var(--border)]">
                <td className="py-2 pr-3">{u.email}</td>
                <td className="py-2 pr-3">{u.name}</td>
                <td className="py-2 pr-3">
                  <span className="inline-flex flex-wrap items-center gap-1">
                    {u.verified ? (
                      <span className="rounded-full bg-[var(--good)]/15 px-2 py-0.5 text-xs text-[var(--good)]">
                        Learner
                      </span>
                    ) : (
                      <span className="rounded-full bg-[var(--panel-2)] px-2 py-0.5 text-xs text-[var(--muted)]">
                        미검증
                      </span>
                    )}
                    {u.isAdmin && (
                      <span className="rounded-full bg-[var(--accent)]/15 px-2 py-0.5 text-xs text-[var(--accent)]">
                        admin
                      </span>
                    )}
                  </span>
                </td>
                <td className="py-2 text-[var(--muted)]">{u.joined}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
