import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { PUT, DELETE } from "./route";
import { auth } from "@/lib/auth";
import { pool } from "@/lib/db";
import { loadQuestionsFromDb } from "@/lib/content-db";
import type { Question } from "@/lib/types";

// 테스트는 Next 요청 컨텍스트가 없어 revalidatePath 가 throw 한다 — no-op 으로 모킹.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// /api/admin/content 의 admin 권한 경계·변경·검증을 실 postgres + better-auth 세션으로 검증
// (이슈 #27 AC). DATABASE_URL 없으면 skip. 0001~0004 마이그레이션 적용 DB 필요.

const BASE = "http://localhost:3000";
const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("/api/admin/content (admin authz + mutation, 실 postgres 필요)", () => {
  const examKey = `test/admin_${Date.now()}`;
  const password = "correct-horse-battery-staple";
  const adminEmail = `admin_${Date.now()}@example.com`;
  const userEmail = `user_${Date.now()}@example.com`;
  let adminCookie = "";
  let userCookie = "";

  const validQ: Question = { qn: 1, topic: "t", q: "질문", options: { A: "a", B: "b" }, answer: ["A"] };

  function authApi(path: string, init?: RequestInit) {
    return auth.handler(
      new Request(`${BASE}/api/auth${path}`, {
        ...init,
        headers: { "content-type": "application/json", origin: BASE, ...(init?.headers ?? {}) },
      }),
    );
  }

  function cookieOf(res: Response): string {
    return res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  }

  async function login(email: string): Promise<string> {
    const res = await authApi("/sign-in/email", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    expect(res.status).toBe(200);
    return cookieOf(res);
  }

  function req(method: "PUT" | "DELETE", body: unknown, cookie?: string) {
    return new Request(`${BASE}/api/admin/content`, {
      method,
      headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
      body: JSON.stringify(body),
    });
  }

  beforeAll(async () => {
    for (const email of [adminEmail, userEmail]) {
      await authApi("/sign-up/email", {
        method: "POST",
        body: JSON.stringify({ name: "u", email, password }),
      });
    }
    // 검증 + admin role 부트스트랩(직접 SQL — 첫 admin 지정 방식)
    await pool.query('update "user" set "emailVerified" = true where email = any($1)', [
      [adminEmail, userEmail],
    ]);
    await pool.query(`update "user" set "role" = 'admin' where email = $1`, [adminEmail]);
    adminCookie = await login(adminEmail);
    userCookie = await login(userEmail);
  });

  afterAll(async () => {
    await pool.query('delete from "question" where "exam_key" = $1', [examKey]);
    await pool.query('delete from "user" where email = any($1)', [[adminEmail, userEmail]]);
    await pool.end();
  });

  it("미인증·비admin 의 PUT 은 403 (콘텐츠 변경 구조적 차단)", async () => {
    const anon = await PUT(req("PUT", { type: "question", examKey, lang: "ko", question: validQ }));
    expect(anon.status).toBe(403);
    const nonAdmin = await PUT(
      req("PUT", { type: "question", examKey, lang: "ko", question: validQ }, userCookie),
    );
    expect(nonAdmin.status).toBe(403);
  });

  it("admin 의 유효 PUT 은 204 + DB 반영", async () => {
    const res = await PUT(
      req("PUT", { type: "question", examKey, lang: "ko", question: validQ }, adminCookie),
    );
    expect(res.status).toBe(204);
    const got = await loadQuestionsFromDb(pool, examKey, "ko");
    expect(got.find((q) => q.qn === 1)?.q).toBe("질문");
  });

  it("정답이 options 에 없으면 400", async () => {
    const badQ = { ...validQ, answer: ["Z"] }; // Z ∉ options
    const res = await PUT(
      req("PUT", { type: "question", examKey, lang: "ko", question: badQ }, adminCookie),
    );
    expect(res.status).toBe(400);
  });

  it("admin 의 DELETE 은 204 + 제거, 비admin 은 403", async () => {
    const forbidden = await DELETE(req("DELETE", { type: "question", examKey, qn: 1 }, userCookie));
    expect(forbidden.status).toBe(403);

    const ok = await DELETE(req("DELETE", { type: "question", examKey, qn: 1 }, adminCookie));
    expect(ok.status).toBe(204);
    const got = await loadQuestionsFromDb(pool, examKey, "ko");
    expect(got.find((q) => q.qn === 1)).toBeUndefined();
  });
});
