import { describe, it, expect } from "vitest";
import { checkDb, getVersion, getStatus } from "./health";

// checkDb 는 어댑터를 주입받아 실DB 없이 up/down 을 단위 검증한다(ADR-0018 · seam=test surface).
describe("checkDb", () => {
  it("select 1 성공이면 up + latencyMs", async () => {
    const r = await checkDb({ query: async () => ({ rows: [{ ok: 1 }] }) });
    expect(r.status).toBe("up");
    expect(r.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("query 가 throw 하면 down — 절대 throw 하지 않는다", async () => {
    const r = await checkDb({
      query: async () => {
        throw new Error("ECONNREFUSED");
      },
    });
    expect(r.status).toBe("down");
    expect(r.latencyMs).toBeGreaterThanOrEqual(0);
  });
});

describe("getVersion", () => {
  it("BUILD_SHA 를 노출하고, 미주입이면 unknown", () => {
    const prev = process.env.BUILD_SHA;
    process.env.BUILD_SHA = "sha-abc123";
    expect(getVersion().sha).toBe("sha-abc123");
    delete process.env.BUILD_SHA;
    expect(getVersion().sha).toBe("unknown");
    if (prev !== undefined) process.env.BUILD_SHA = prev;
  });
});

describe("getStatus", () => {
  it("주입된 어댑터로 db 를 진단하고, 시크릿·접속정보를 담지 않는다", async () => {
    const s = await getStatus({ query: async () => ({ rows: [] }) });
    expect(s.db.status).toBe("up");
    expect(s.sha).toBeDefined();
    expect(s.uptimeSec).toBeGreaterThanOrEqual(0);
    expect(typeof s.startedAt).toBe("string");
    // 페이로드는 화이트리스트 키만 — DATABASE_URL·호스트/포트·stack 이 절대 새지 않는다.
    expect(Object.keys(s).sort()).toEqual(["db", "now", "sha", "startedAt", "uptimeSec"]);
    expect(JSON.stringify(s)).not.toMatch(/DATABASE_URL|postgres:\/\/|password/i);
  });

  it("db 가 down 이어도 getStatus 는 throw 하지 않고 진단을 돌려준다", async () => {
    const s = await getStatus({
      query: async () => {
        throw new Error("down");
      },
    });
    expect(s.db.status).toBe("down");
    expect(s.sha).toBeDefined();
  });
});
