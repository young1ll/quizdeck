import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import { GET, PUT } from "./route";
import { auth } from "@/lib/auth";
import { emptyProgress } from "@/lib/progress";

// 인가·검증 경로의 DB 무관 단위 테스트 (이슈 #7 보안 AC). 세션 해석만 모킹하면
// 401/400 분기는 postgres 없이도 검증된다 — DATABASE_URL 없는 CI 에서도 항상 실행된다.
// (실 read/write·세션 스코프 round-trip 은 route.integration.test.ts 가 실 postgres 로 증명.)
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

const BASE = "http://localhost:3000/api/progress";
const getSession = auth.api.getSession as unknown as Mock;

function req(method: "GET" | "PUT", url: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  getSession.mockReset();
});

describe("/api/progress — 인가", () => {
  it("미인증(세션 없음) GET 은 401", async () => {
    getSession.mockResolvedValue(null);
    const res = await GET(req("GET", `${BASE}?exam=aws/x`));
    expect(res.status).toBe(401);
  });

  it("미인증 PUT 은 401 (저장 시도 전 차단)", async () => {
    getSession.mockResolvedValue(null);
    const res = await PUT(
      req("PUT", BASE, { exam: "aws/x", snapshot: emptyProgress(), updatedAt: 1000 }),
    );
    expect(res.status).toBe(401);
  });
});

describe("/api/progress — 입력 검증 (인증됨)", () => {
  beforeEach(() => {
    getSession.mockResolvedValue({ user: { id: "learner-1" } });
  });

  it("exam 파라미터 없는 GET 은 400", async () => {
    const res = await GET(req("GET", BASE));
    expect(res.status).toBe(400);
  });

  it("snapshot·updatedAt 누락 PUT 은 400", async () => {
    const res = await PUT(req("PUT", BASE, { exam: "aws/x" }));
    expect(res.status).toBe(400);
  });

  it("snapshot 이 배열이면 PUT 은 400 (봉투 계약 위반 거절)", async () => {
    const res = await PUT(req("PUT", BASE, { exam: "aws/x", snapshot: [], updatedAt: 1000 }));
    expect(res.status).toBe(400);
  });

  it("본문이 JSON 이 아니면 PUT 은 400", async () => {
    const bad = new Request(BASE, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: "not json",
    });
    const res = await PUT(bad);
    expect(res.status).toBe(400);
  });
});
