import { describe, it, expect } from "vitest";
import { GET } from "./route";

// /api/health 는 liveness 엔드포인트 — Route Handler 토대가 살아 있음(이슈 #3)을 증명하고 build sha 를
// 공개 노출한다(ADR-0018). DB 무관이라 항상 200.
describe("GET /api/health", () => {
  it("200 으로 { ok:true, sha } 를 응답한다 (liveness · DB 무관)", async () => {
    const res = GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body).toHaveProperty("sha");
  });
});
