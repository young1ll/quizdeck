import { describe, it, expect, afterAll } from "vitest";
import { auth } from "./auth";
import { pool } from "./db";

// better-auth 이메일+비밀번호 전체 흐름을 실제 postgres 에서 실증한다 (이슈 #6 + ADR-0004).
// DATABASE_URL 이 없으면 skip — 무DB CI 는 그대로 그린. 로컬/통합은 docker postgres 로 실행:
//   DATABASE_URL=postgres://quizdeck:quizdeck@localhost:55432/quizdeck \
//   BETTER_AUTH_SECRET=... BETTER_AUTH_URL=http://localhost:3000 pnpm test
//
// 이메일 검증 필수(ADR-0004): 가입해도 검증 전엔 세션 없음·로그인 차단. 검증 메일 발송은
// RESEND_API_KEY 미설정·비프로덕션이라 email.ts 가 콘솔로 건너뛴다(테스트는 발송 무관).
// auth.handler 를 직접 두드려 Route Handler 가 마운트하는 것과 동일한 HTTP 표면을 검증한다.

const BASE = "http://localhost:3000";
const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("better-auth 이메일+비밀번호 통합 (실제 postgres 필요)", () => {
  const email = `learner_${Date.now()}@example.com`;
  const password = "correct-horse-battery-staple";
  const name = "테스트 러너";
  let sessionCookie = "";

  function api(path: string, init?: RequestInit) {
    return auth.handler(
      new Request(`${BASE}/api/auth${path}`, {
        ...init,
        headers: {
          "content-type": "application/json",
          origin: BASE, // CSRF: trustedOrigins(=baseURL) 와 일치해야 통과
          ...(init?.headers ?? {}),
        },
      }),
    );
  }

  // Set-Cookie 들에서 name=value 만 추려 Cookie 헤더로 조립
  function cookieHeaderFrom(res: Response): string {
    return res.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
  }

  afterAll(async () => {
    await pool.end();
  });

  it("가입하면 user·account 행이 생기고 비밀번호는 해시로 저장된다 — 검증 전엔 세션 없음", async () => {
    const res = await api("/sign-up/email", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });
    expect(res.status).toBe(200);

    // 이메일 인증 필수 → autoSignIn 차단: 가입 응답에 세션 쿠키가 없어야 한다 (ADR-0004)
    const sc = res.headers.getSetCookie().find((c) => c.includes("session_token"));
    expect(sc, "검증 전엔 세션 쿠키가 발급되지 않아야 한다").toBeFalsy();

    const u = await pool.query<{ id: string; emailVerified: boolean }>(
      'select id, "emailVerified" from "user" where email = $1',
      [email],
    );
    expect(u.rowCount).toBe(1);
    expect(u.rows[0].emailVerified).toBe(false); // 아직 미검증

    const a = await pool.query<{ password: string | null }>(
      'select password from "account" where "userId" = $1 and "providerId" = $2',
      [u.rows[0].id, "credential"],
    );
    expect(a.rowCount).toBe(1);
    expect(a.rows[0].password).toBeTruthy();
    // 평문 저장이 아님(해시) — better-auth 기본 scrypt
    expect(a.rows[0].password).not.toContain(password);
  });

  it("검증 전 로그인은 거부된다 (이메일 인증 필요)", async () => {
    const res = await api("/sign-in/email", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);

    const sc = res.headers.getSetCookie().find((c) => c.includes("session_token"));
    expect(sc, "미검증 로그인엔 세션 쿠키가 없어야 한다").toBeFalsy();
  });

  it("이메일 검증 후 로그인하면 세션이 발급되고 get-session 이 그 Learner 를 식별한다", async () => {
    // 검증 링크 클릭을 DB 플래그로 시뮬레이트한다 — verify-email 엔드포인트가 만드는 상태와 동일.
    await pool.query('update "user" set "emailVerified" = true where email = $1', [email]);

    const res = await api("/sign-in/email", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    expect(res.status).toBe(200);
    sessionCookie = cookieHeaderFrom(res);
    expect(sessionCookie).toMatch(/session_token/);

    const sess = await api("/get-session", { headers: { cookie: sessionCookie } });
    expect(sess.status).toBe(200);
    const body = (await sess.json()) as { user?: { email?: string } } | null;
    expect(body?.user?.email).toBe(email);
  });

  it("잘못된 비밀번호는 거부된다", async () => {
    const res = await api("/sign-in/email", {
      method: "POST",
      body: JSON.stringify({ email, password: "definitely-wrong" }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("쿠키 동반 교차 오리진 요청은 CSRF 보호로 거부된다", async () => {
    // better-auth 의 origin 검사는 쿠키가 동반된(=실제 CSRF 벡터) 요청에서만 강제된다.
    // 쿠키 + trustedOrigins(=baseURL) 불일치 Origin → password 검증 이전에 403.
    const res = await auth.handler(
      new Request(`${BASE}/api/auth/sign-in/email`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://evil.example",
          cookie: "better-auth.session_token=dummy", // 쿠키 동반 → origin 검증 활성
        },
        body: JSON.stringify({ email, password }),
      }),
    );
    expect(res.status).toBe(403);
  });

  it("JWKS 엔드포인트가 keys 를 노출한다 (미래 JWT 검증 경로, 소비자 없음)", async () => {
    const res = await api("/jwks", { method: "GET" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { keys?: unknown[] };
    expect(Array.isArray(body.keys)).toBe(true);
    expect(body.keys!.length).toBeGreaterThan(0);
  });

  it("로그아웃하면 세션이 무효화된다", async () => {
    const out = await api("/sign-out", {
      method: "POST",
      headers: { cookie: sessionCookie },
    });
    expect(out.status).toBe(200);

    const sess = await api("/get-session", { headers: { cookie: sessionCookie } });
    const body = (await sess.json().catch(() => null)) as { user?: unknown } | null;
    expect(body?.user).toBeFalsy();
  });
});
