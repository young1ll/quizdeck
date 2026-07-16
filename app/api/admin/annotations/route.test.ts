import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Mock } from "vitest";
import { GET, PATCH, DELETE } from "./route";
import * as db from "@/lib/admin-annotation-db";

// wp-admin 서버-서버 API 의 토큰 인가·검증 경로 DB 무관 단위 테스트 (ADR-0027). 핵심은
// withServiceToken 의 fail-closed(토큰 env 미설정이면 무엇을 보내도 401) + DB 미도달.
vi.mock("@/lib/admin-annotation-db", () => ({
  getLearnerSummary: vi.fn(),
  listAnnotationsByLearner: vi.fn(),
  adminUpdateAnnotation: vi.fn(),
  adminDeleteAnnotation: vi.fn(),
}));

const BASE = "http://localhost:3000/api/admin/annotations";
const TOKEN = "test-admin-token";
const summary = db.getLearnerSummary as unknown as Mock;
const list = db.listAnnotationsByLearner as unknown as Mock;
const update = db.adminUpdateAnnotation as unknown as Mock;
const del = db.adminDeleteAnnotation as unknown as Mock;

const validBody = { id: "anno-1", memo: "메모", kind: "underline" };

function req(
  method: "GET" | "PATCH" | "DELETE",
  url: string,
  opts: { body?: unknown; token?: string; actor?: string } = {},
): Request {
  return new Request(url, {
    method,
    headers: {
      "content-type": "application/json",
      ...(opts.token ? { "x-qd-token": opts.token } : {}),
      ...(opts.actor ? { "x-qd-actor": opts.actor } : {}),
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
}

beforeEach(() => {
  process.env.ADMIN_API_TOKEN = TOKEN;
  summary.mockReset();
  list.mockReset();
  update.mockReset();
  del.mockReset();
});
afterEach(() => {
  delete process.env.ADMIN_API_TOKEN;
});

describe("/api/admin/annotations 인가 — 서비스 토큰 fail-closed", () => {
  it("토큰 env 미설정이면 무엇을 보내도 401 — DB 에 닿지 않는다", async () => {
    delete process.env.ADMIN_API_TOKEN;
    expect((await GET(req("GET", `${BASE}?learner=u1`, { token: TOKEN }))).status).toBe(401);
    expect((await PATCH(req("PATCH", BASE, { body: validBody, token: TOKEN }))).status).toBe(401);
    expect((await DELETE(req("DELETE", `${BASE}?id=anno-1`, { token: TOKEN }))).status).toBe(401);
    expect(summary).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
  });

  it("토큰 누락·불일치는 401 — DB 미도달", async () => {
    expect((await GET(req("GET", `${BASE}?learner=u1`))).status).toBe(401);
    expect((await PATCH(req("PATCH", BASE, { body: validBody, token: "wrong" }))).status).toBe(401);
    expect((await DELETE(req("DELETE", `${BASE}?id=anno-1`, { token: "wrong" }))).status).toBe(401);
    expect(summary).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
  });
});

describe("GET — 회원 요약 + 주석 목록", () => {
  it("회원이 있으면 { learner, annotations }", async () => {
    summary.mockResolvedValue({ id: "u1", name: "A", email: "a@x.com", emailVerified: true });
    list.mockResolvedValue([{ id: "anno-1" }]);
    const res = await GET(req("GET", `${BASE}?learner=u1`, { token: TOKEN }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      learner: { id: "u1", name: "A", email: "a@x.com", emailVerified: true },
      annotations: [{ id: "anno-1" }],
    });
    expect(list).toHaveBeenCalledWith(expect.anything(), "u1");
  });

  it("learner 누락은 400, 없는 회원은 404 — 목록 미조회", async () => {
    expect((await GET(req("GET", BASE, { token: TOKEN }))).status).toBe(400);
    summary.mockResolvedValue(null);
    expect((await GET(req("GET", `${BASE}?learner=none`, { token: TOKEN }))).status).toBe(404);
    expect(list).not.toHaveBeenCalled();
  });
});

describe("PATCH — 검증 + memo/kind 갱신", () => {
  it("유효 body 는 204 — id 기준 memo/kind 만 위임", async () => {
    update.mockResolvedValue(true);
    const res = await PATCH(req("PATCH", BASE, { body: validBody, token: TOKEN }));
    expect(res.status).toBe(204);
    expect(update).toHaveBeenCalledWith(expect.anything(), "anno-1", {
      memo: "메모",
      kind: "underline",
    });
  });

  it("memo null 은 메모 삭제로 위임", async () => {
    update.mockResolvedValue(true);
    const res = await PATCH(
      req("PATCH", BASE, { body: { id: "anno-1", memo: null, kind: "highlight" }, token: TOKEN }),
    );
    expect(res.status).toBe(204);
    expect(update).toHaveBeenCalledWith(expect.anything(), "anno-1", {
      memo: null,
      kind: "highlight",
    });
  });

  it("검증 실패(id 누락·잘못된 kind·비문자열 memo)는 400 — DB 미도달", async () => {
    const cases = [
      { ...validBody, id: "" },
      { ...validBody, kind: "bold" },
      { ...validBody, memo: 7 },
    ];
    for (const body of cases) {
      expect((await PATCH(req("PATCH", BASE, { body, token: TOKEN }))).status).toBe(400);
    }
    expect(update).not.toHaveBeenCalled();
  });

  it("잘못된 JSON 은 400, 없는 id 는 404", async () => {
    const bad = new Request(BASE, {
      method: "PATCH",
      headers: { "x-qd-token": TOKEN },
      body: "{oops",
    });
    expect((await PATCH(bad)).status).toBe(400);
    update.mockResolvedValue(false);
    expect((await PATCH(req("PATCH", BASE, { body: validBody, token: TOKEN }))).status).toBe(404);
  });
});

describe("DELETE — id 기준 삭제", () => {
  it("204 + id 위임", async () => {
    del.mockResolvedValue(true);
    const res = await DELETE(req("DELETE", `${BASE}?id=anno-1`, { token: TOKEN, actor: "wp-editor" }));
    expect(res.status).toBe(204);
    expect(del).toHaveBeenCalledWith(expect.anything(), "anno-1");
  });

  it("id 누락은 400, 없는 id 는 404", async () => {
    expect((await DELETE(req("DELETE", BASE, { token: TOKEN }))).status).toBe(400);
    expect(del).not.toHaveBeenCalled();
    del.mockResolvedValue(false);
    expect((await DELETE(req("DELETE", `${BASE}?id=x`, { token: TOKEN }))).status).toBe(404);
  });
});
