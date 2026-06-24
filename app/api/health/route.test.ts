import { describe, it, expect } from "vitest";
import { GET } from "./route";

// /api/health 는 Route Handler 토대가 살아 있음을 증명하는 사소한 헬스 엔드포인트다
// (이슈 #3 — standalone 전환의 acceptance criterion).
describe("GET /api/health", () => {
  it("200으로 { status: 'ok' } 를 응답한다", async () => {
    const res = GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: "ok" });
  });
});
