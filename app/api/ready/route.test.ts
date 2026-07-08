import { describe, it, expect } from "vitest";
import { GET } from "./route";

// readiness 는 DB 무관 — 앱이 요청 수용 준비됐음만 증명한다(ADR-0018).
describe("GET /api/ready", () => {
  it("200 으로 { ready:true } 를 응답한다", async () => {
    const res = GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ready: true });
  });
});
