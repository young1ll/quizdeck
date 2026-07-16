import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Mock } from "vitest";
import { GET } from "./route";
import * as db from "@/lib/admin-annotation-db";

// 회원 검색 API 의 토큰 인가 단위 테스트 — annotations route.test 와 같은 하니스 (ADR-0027).
vi.mock("@/lib/admin-annotation-db", () => ({
  searchLearnersWithAnnotations: vi.fn(),
}));

const BASE = "http://localhost:3000/api/admin/learners";
const TOKEN = "test-admin-token";
const search = db.searchLearnersWithAnnotations as unknown as Mock;

function req(url: string, token?: string): Request {
  return new Request(url, { headers: token ? { "x-qd-token": token } : {} });
}

beforeEach(() => {
  process.env.ADMIN_API_TOKEN = TOKEN;
  search.mockReset();
});
afterEach(() => {
  delete process.env.ADMIN_API_TOKEN;
});

describe("/api/admin/learners", () => {
  it("토큰 env 미설정이면 401(fail-closed), 누락·불일치도 401 — DB 미도달", async () => {
    delete process.env.ADMIN_API_TOKEN;
    expect((await GET(req(BASE, TOKEN))).status).toBe(401);
    process.env.ADMIN_API_TOKEN = TOKEN;
    expect((await GET(req(BASE))).status).toBe(401);
    expect((await GET(req(BASE, "wrong"))).status).toBe(401);
    expect(search).not.toHaveBeenCalled();
  });

  it("유효 토큰이면 q 를 trim 해 검색 결과를 돌려준다", async () => {
    search.mockResolvedValue([{ id: "u1", annotationCount: 3 }]);
    const res = await GET(req(`${BASE}?q=%20abc%20`, TOKEN));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ id: "u1", annotationCount: 3 }]);
    expect(search).toHaveBeenCalledWith(expect.anything(), "abc");
  });

  it("q 부재는 빈 문자열 검색(전체 상위)", async () => {
    search.mockResolvedValue([]);
    expect((await GET(req(BASE, TOKEN))).status).toBe(200);
    expect(search).toHaveBeenCalledWith(expect.anything(), "");
  });
});
