import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import { GET, PUT, DELETE } from "./route";
import { auth } from "@/lib/auth";
import * as db from "@/lib/annotation-db";
import type { Annotation } from "@/lib/annotation";

// 인가·검증 경로의 DB 무관 단위 테스트 (이슈 #29 보안 AC). 세션과 db 어댑터만 모킹하면 401/400 분기
// + 세션→learner_id 스코프가 postgres 없이 검증된다. (실 round-trip·탈취 가드는 통합 테스트가 증명.)
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/lib/annotation-db", () => ({
  listAnnotations: vi.fn(),
  upsertAnnotation: vi.fn(),
  deleteAnnotation: vi.fn(),
}));

const BASE = "http://localhost:3000/api/annotations";
const getSession = auth.api.getSession as unknown as Mock;
const upsert = db.upsertAnnotation as unknown as Mock;
const del = db.deleteAnnotation as unknown as Mock;
const list = db.listAnnotations as unknown as Mock;

const validAnn: Annotation = {
  id: "ann-1",
  qn: 3,
  lang: "ko",
  field: "q",
  kind: "highlight",
  memo: null,
  anchor: { quote: "객체 스토리지", prefix: "S3 는 ", suffix: "이다" },
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
  upsert.mockReset();
  del.mockReset();
  list.mockReset();
});

describe("/api/annotations — 인가", () => {
  it("미인증 GET/PUT/DELETE 는 401 (DB 접근 전 차단)", async () => {
    getSession.mockResolvedValue(null);
    expect((await GET(req("GET", `${BASE}?exam=aws/x`))).status).toBe(401);
    expect((await PUT(req("PUT", BASE, { exam: "aws/x", annotation: validAnn }))).status).toBe(401);
    expect((await DELETE(req("DELETE", `${BASE}?id=ann-1`))).status).toBe(401);
    expect(upsert).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
  });
});

describe("/api/annotations — 검증·스코프 (인증됨)", () => {
  beforeEach(() => {
    // Learner = 이메일 검증된 신원 — requireLearner 가 emailVerified 를 직접 본다(ADR-0004 애던덤).
    getSession.mockResolvedValue({ user: { id: "learner-1", emailVerified: true } });
  });

  it("exam 없는 GET 은 400", async () => {
    expect((await GET(req("GET", BASE))).status).toBe(400);
  });

  it("GET 은 세션 learner_id 로 스코프해 목록을 돌려준다", async () => {
    list.mockResolvedValue([validAnn]);
    const res = await GET(req("GET", `${BASE}?exam=aws/x`));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([validAnn]);
    expect(list).toHaveBeenCalledWith(expect.anything(), "learner-1", "aws/x");
  });

  it("형태가 깨진 annotation 은 PUT 400 (저장 안 함)", async () => {
    const bad = { ...validAnn, kind: "rainbow" }; // kind 미허용
    expect((await PUT(req("PUT", BASE, { exam: "aws/x", annotation: bad }))).status).toBe(400);
    expect((await PUT(req("PUT", BASE, { annotation: validAnn }))).status).toBe(400); // exam 누락
    expect(upsert).not.toHaveBeenCalled();
  });

  it("정상 PUT 은 세션 learner_id 로 스코프해 upsert 하고 204", async () => {
    const res = await PUT(req("PUT", BASE, { exam: "aws/x", annotation: validAnn }));
    expect(res.status).toBe(204);
    expect(upsert).toHaveBeenCalledWith(expect.anything(), "learner-1", "aws/x", validAnn);
  });

  it("id 없는 DELETE 는 400, 정상 DELETE 는 세션 스코프 + 204", async () => {
    expect((await DELETE(req("DELETE", BASE))).status).toBe(400);
    const res = await DELETE(req("DELETE", `${BASE}?id=ann-1`));
    expect(res.status).toBe(204);
    expect(del).toHaveBeenCalledWith(expect.anything(), "learner-1", "ann-1");
  });
});
