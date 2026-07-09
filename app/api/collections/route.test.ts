import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import { GET, PUT, DELETE } from "./route";
import { auth } from "@/lib/auth";
import * as db from "@/lib/collection-db";

// 인가·검증 경로의 DB 무관 단위 테스트 — annotations route.test 와 같은 하니스. 세션과 db 어댑터만
// 모킹하면 401/400 분기 + 세션→learner_id 스코프가 postgres 없이 검증된다.
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/lib/collection-db", () => ({
  listCollections: vi.fn(),
  upsertCollection: vi.fn(),
  deleteCollection: vi.fn(),
}));

const BASE = "http://localhost:3000/api/collections";
const getSession = auth.api.getSession as unknown as Mock;
const list = db.listCollections as unknown as Mock;
const upsert = db.upsertCollection as unknown as Mock;
const del = db.deleteCollection as unknown as Mock;

const validCol = {
  id: "col-1",
  name: "약점 모음",
  items: [
    { examKey: "aws/saa-c03", qn: 7 },
    { examKey: "aws/sap-c02", qn: 101 },
  ],
  updatedAt: 1000,
};

function req(method: "GET" | "PUT" | "DELETE", url: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  getSession.mockReset();
  list.mockReset();
  upsert.mockReset();
  del.mockReset();
});

const learner = { user: { id: "u1", emailVerified: true } };

describe("/api/collections 인가", () => {
  it("미인증이면 401 — 어떤 메서드도 DB 에 닿지 않는다", async () => {
    getSession.mockResolvedValue(null);
    expect((await GET(req("GET", BASE))).status).toBe(401);
    expect((await PUT(req("PUT", BASE, { collection: validCol }))).status).toBe(401);
    expect((await DELETE(req("DELETE", `${BASE}?id=col-1`))).status).toBe(401);
    expect(list).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
  });

  it("이메일 미인증 사용자는 Learner 가 아니다 → 401", async () => {
    getSession.mockResolvedValue({ user: { id: "u1", emailVerified: false } });
    expect((await GET(req("GET", BASE))).status).toBe(401);
  });
});

describe("GET — 세션 learner 스코프 목록", () => {
  it("세션 user.id 로 스코프해 목록을 돌려준다", async () => {
    getSession.mockResolvedValue(learner);
    list.mockResolvedValue([validCol]);
    const res = await GET(req("GET", BASE));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([validCol]);
    expect(list).toHaveBeenCalledWith(expect.anything(), "u1");
  });
});

describe("PUT — 경계 검증 + learner 스코프 upsert", () => {
  it("유효 컬렉션은 204 + 세션 learner 로 upsert(중복 items 정규화)", async () => {
    getSession.mockResolvedValue(learner);
    const res = await PUT(
      req("PUT", BASE, {
        collection: { ...validCol, items: [...validCol.items, validCol.items[0]] },
      }),
    );
    expect(res.status).toBe(204);
    expect(upsert).toHaveBeenCalledWith(
      expect.anything(),
      "u1",
      expect.objectContaining({ id: "col-1", items: validCol.items }),
    );
  });

  it("검증 실패(빈 이름·items 불량) 는 400 — DB 미도달", async () => {
    getSession.mockResolvedValue(learner);
    expect((await PUT(req("PUT", BASE, { collection: { ...validCol, name: "" } }))).status).toBe(
      400,
    );
    expect(
      (await PUT(req("PUT", BASE, { collection: { ...validCol, items: [{ qn: 1 }] } }))).status,
    ).toBe(400);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("잘못된 JSON 은 400", async () => {
    getSession.mockResolvedValue(learner);
    const bad = new Request(BASE, { method: "PUT", body: "{oops" });
    expect((await PUT(bad)).status).toBe(400);
  });
});

describe("DELETE — learner 스코프 삭제", () => {
  it("id 로 세션 learner 스코프 삭제 → 204", async () => {
    getSession.mockResolvedValue(learner);
    const res = await DELETE(req("DELETE", `${BASE}?id=col-1`));
    expect(res.status).toBe(204);
    expect(del).toHaveBeenCalledWith(expect.anything(), "u1", "col-1");
  });

  it("id 누락은 400", async () => {
    getSession.mockResolvedValue(learner);
    expect((await DELETE(req("DELETE", BASE))).status).toBe(400);
    expect(del).not.toHaveBeenCalled();
  });
});
