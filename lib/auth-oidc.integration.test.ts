import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { pool } from "./db";

// OAuth 2.1 provider(ADR-0028 — wp-admin SSO IdP)의 HTTP 표면을 실 postgres 로 검증한다.
// auth.integration.test 와 같은 하니스(auth.handler 직접 — Route Handler 와 동일 표면).
// 0012(oauthClient 등 4테이블) 적용된 DB 필요. DATABASE_URL 없으면 skip.
// oauthProvider 플러그인은 baseURL 있을 때만 끼워지므로(lib/auth.ts 조건부) BETTER_AUTH_URL 을
// import 전에 세팅한다 — vitest 는 파일별 모듈 격리라 다른 테스트 파일에 영향 없음.
const hasDb = Boolean(process.env.DATABASE_URL);
process.env.BETTER_AUTH_URL ??= "http://localhost:3000";
const BASE = process.env.BETTER_AUTH_URL;
const { auth } = await import("./auth");

// wp 클라이언트와 같은 형태의 행을 시드 — 프로드 시드(README 0012 절)와 동일 컬럼 조합.
const CLIENT = `test-wp-${Date.now()}`;
const REDIRECT = "https://wp.example/wp-admin/admin-ajax.php?action=openid-connect-authorize";

describe.skipIf(!hasDb)("oauth-provider (실 postgres 필요)", () => {
  beforeAll(async () => {
    await pool.query(
      `insert into "oauthClient"
        ("id","clientId","clientSecret","disabled","skipConsent","redirectUris",
         "tokenEndpointAuthMethod","grantTypes","responseTypes","public","type","requirePKCE",
         "name","scopes","createdAt","updatedAt")
       values ($1,$1,'unused-hash',false,true,$2::jsonb,'client_secret_post',
         '["authorization_code"]'::jsonb,'["code"]'::jsonb,false,'web',false,
         'integration test','["openid","profile","email"]'::jsonb,now(),now())`,
      [CLIENT, JSON.stringify([REDIRECT])],
    );
  });
  afterAll(async () => {
    await pool.query(`delete from "oauthClient" where "id" = $1`, [CLIENT]);
  });
  it("OIDC discovery — issuer 와 엔드포인트가 /api/auth 아래로 공개된다", async () => {
    const res = await auth.handler(
      new Request(`${BASE}/api/auth/.well-known/openid-configuration`),
    );
    expect(res.status).toBe(200);
    const meta = (await res.json()) as Record<string, string>;
    expect(meta.issuer).toBe(`${BASE}/api/auth`);
    expect(meta.authorization_endpoint).toBe(`${BASE}/api/auth/oauth2/authorize`);
    expect(meta.token_endpoint).toBe(`${BASE}/api/auth/oauth2/token`);
    expect(meta.userinfo_endpoint).toBe(`${BASE}/api/auth/oauth2/userinfo`);
    expect(meta.jwks_uri).toBe(`${BASE}/api/auth/jwks`);
  });

  it("authorize — 미인증이면 loginPage(/login)로 보낸다(302, flow 재개 파라미터 동반)", async () => {
    const url =
      `${BASE}/api/auth/oauth2/authorize?client_id=${CLIENT}&response_type=code` +
      `&scope=openid+profile+email&state=s1&redirect_uri=${encodeURIComponent(REDIRECT)}`;
    const res = await auth.handler(new Request(url, { redirect: "manual" }));
    expect(res.status).toBe(302);
    const loc = res.headers.get("location") ?? "";
    expect(loc).toContain("/login");
  });

  it("token — 등록 안 된 클라이언트/엉터리 요청은 실패한다(2xx 아님)", async () => {
    const res = await auth.handler(
      new Request(`${BASE}/api/auth/oauth2/token`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "grant_type=authorization_code&code=bogus&client_id=nope&client_secret=nope",
      }),
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
