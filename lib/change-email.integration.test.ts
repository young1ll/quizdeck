import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { auth } from "./auth";
import { pool } from "./db";

// 이메일 변경(changeEmail)의 핵심 보증을 실 postgres + better-auth 세션으로 검증한다 (이슈 #38 AC1):
// **인증 전까지 기존 이메일을 유지**한다(클릭 시에만 교체). 진행(#7) 통합 테스트와 같은 auth.handler
// 세션 셋업. DATABASE_URL 없으면 skip — 무DB CI 는 그대로 그린.
const hasDb = Boolean(process.env.DATABASE_URL);
const BASE = "http://localhost:3000";

describe.skipIf(!hasDb)("이메일 변경 (세션 + 실 postgres 필요)", () => {
  const oldEmail = `chg_old_${Date.now()}@example.com`;
  const newEmail = `chg_new_${Date.now()}@example.com`;
  const password = "correct-horse-battery-staple";
  let cookie = "";

  function authApi(path: string, init?: RequestInit) {
    return auth.handler(
      new Request(`${BASE}/api/auth${path}`, {
        ...init,
        headers: { "content-type": "application/json", origin: BASE, ...(init?.headers ?? {}) },
      }),
    );
  }

  beforeAll(async () => {
    await authApi("/sign-up/email", {
      method: "POST",
      body: JSON.stringify({ name: "Chg", email: oldEmail, password }),
    });
    // 검증 플래그를 세우고 로그인해 세션 쿠키 확보(검증 링크 클릭과 동일 상태).
    await pool.query('update "user" set "emailVerified" = true where email = $1', [oldEmail]);
    const signin = await authApi("/sign-in/email", {
      method: "POST",
      body: JSON.stringify({ email: oldEmail, password }),
    });
    expect(signin.status).toBe(200);
    cookie = signin.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
  });
  afterAll(async () => {
    await pool.query(`delete from "user" where email in ($1, $2)`, [oldEmail, newEmail]);
  });

  it("변경 요청은 성공하되, 인증 전까지 기존 이메일을 유지한다(새 이메일로 아직 안 바뀜)", async () => {
    const res = await authApi("/change-email", {
      method: "POST",
      headers: { cookie },
      body: JSON.stringify({ newEmail, callbackURL: "/" }),
    });
    expect(res.status).toBe(200);

    // 기존 이메일 행은 그대로, 새 이메일로는 아직 안 바뀜 — 링크 클릭 시에만 교체된다.
    const stillOld = await pool.query('select 1 from "user" where email = $1', [oldEmail]);
    expect(stillOld.rowCount).toBe(1);
    const notYet = await pool.query('select 1 from "user" where email = $1', [newEmail]);
    expect(notYet.rowCount).toBe(0);
  });

  it("미인증 요청은 거절한다(세션 쿠키 없음)", async () => {
    const res = await authApi("/change-email", {
      method: "POST",
      body: JSON.stringify({ newEmail, callbackURL: "/" }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
