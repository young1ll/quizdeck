import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { GET, PUT } from "./route";
import { auth } from "@/lib/auth";
import { pool } from "@/lib/db";
import { emptyProgress, recordResult } from "@/lib/progress";

// /api/progress 의 세션 스코프·인가를 실 postgres + better-auth 세션으로 검증한다 (이슈 #7 AC).
// DATABASE_URL 없으면 skip — 무DB CI 는 그대로 그린.
//   DATABASE_URL=... BETTER_AUTH_SECRET=... BETTER_AUTH_URL=http://localhost:3000 pnpm test

const BASE = "http://localhost:3000";
const hasDb = Boolean(process.env.DATABASE_URL);
const NOW = Date.parse("2026-06-23T10:00:00Z");

describe.skipIf(!hasDb)("/api/progress (세션 + 실 postgres 필요)", () => {
  const email = `progress_learner_${Date.now()}@example.com`;
  const password = "correct-horse-battery-staple";
  let cookie = "";
  let learnerId = "";

  function authApi(path: string, init?: RequestInit) {
    return auth.handler(
      new Request(`${BASE}/api/auth${path}`, {
        ...init,
        headers: {
          "content-type": "application/json",
          origin: BASE,
          ...(init?.headers ?? {}),
        },
      }),
    );
  }

  function progressReq(
    method: "GET" | "PUT",
    opts: { exam?: string; body?: unknown; withCookie?: boolean } = {},
  ): Request {
    const url =
      opts.exam !== undefined
        ? `${BASE}/api/progress?exam=${encodeURIComponent(opts.exam)}`
        : `${BASE}/api/progress`;
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (opts.withCookie ?? true) headers.cookie = cookie;
    return new Request(url, {
      method,
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  }

  beforeAll(async () => {
    const res = await authApi("/sign-up/email", {
      method: "POST",
      body: JSON.stringify({ name: "러너", email, password }),
    });
    expect(res.status).toBe(200);
    const u = await pool.query<{ id: string }>('select id from "user" where email = $1', [email]);
    learnerId = u.rows[0].id;

    // 이메일 인증 필수(ADR-0004) → 가입만으론 세션이 없다. 검증 플래그를 세우고 로그인해
    // 세션 쿠키를 얻는다(검증 링크 클릭과 동일 상태).
    await pool.query('update "user" set "emailVerified" = true where email = $1', [email]);
    const signin = await authApi("/sign-in/email", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    expect(signin.status).toBe(200);
    cookie = signin.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
  });

  afterAll(async () => {
    await pool.query('delete from "user" where "id" = $1', [learnerId]); // progress 도 cascade 삭제
    await pool.end();
  });

  it("미인증 요청은 401 로 거절된다 (GET·PUT)", async () => {
    const g = await GET(progressReq("GET", { exam: "aws/x", withCookie: false }));
    expect(g.status).toBe(401);
    const p = await PUT(
      progressReq("PUT", {
        body: { exam: "aws/x", snapshot: emptyProgress(), updatedAt: 1000 },
        withCookie: false,
      }),
    );
    expect(p.status).toBe(401);
  });

  it("exam 파라미터 없는 GET 은 400", async () => {
    const g = await GET(progressReq("GET"));
    expect(g.status).toBe(400);
  });

  it("처음엔 GET 이 200 null 을 낸다", async () => {
    const g = await GET(progressReq("GET", { exam: "aws/fresh" }));
    expect(g.status).toBe(200);
    expect(await g.json()).toBeNull();
  });

  it("PUT 저장 후 GET 이 같은 봉투를 낸다 (세션 Learner 로 스코프)", async () => {
    const snap = recordResult(emptyProgress(), 7, ["B"], false, NOW);
    const at = Date.parse("2026-06-23T11:30:00Z");

    const put = await PUT(
      progressReq("PUT", { body: { exam: "aws/sap-c02", snapshot: snap, updatedAt: at } }),
    );
    expect(put.status).toBe(204);

    const get = await GET(progressReq("GET", { exam: "aws/sap-c02" }));
    expect(get.status).toBe(200);
    expect(await get.json()).toEqual({ snapshot: snap, updatedAt: at });

    // client 는 learner_id 를 보낸 적 없다 — 서버가 세션에서 스코프했음을 DB 로 확인
    const row = await pool.query<{ learner_id: string }>(
      'select "learner_id" from "progress" where "exam_key" = $1',
      ["aws/sap-c02"],
    );
    expect(row.rows.every((r) => r.learner_id === learnerId)).toBe(true);
  });

  it("PUT 의 잘못된 body 는 400", async () => {
    const bad = await PUT(progressReq("PUT", { body: { exam: "aws/x" } })); // snapshot·updatedAt 누락
    expect(bad.status).toBe(400);
  });
});
