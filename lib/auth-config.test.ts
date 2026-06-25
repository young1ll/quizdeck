import { describe, it, expect } from "vitest";
import { resolveAuthConfig, assertAuthConfigReady } from "./auth-config";

// better-auth 런타임 env 해석 seam (이슈 #6). 순수 함수 — DB·네트워크 미접촉.
// auth.ts 는 import 시 throw 하면 `next build`(env 없음)가 깨지므로, 해석기는
// throw 하지 않고 missing 을 보고하고, 명시적 assert 로만 강제한다.
describe("resolveAuthConfig", () => {
  const full = {
    BETTER_AUTH_SECRET: "s3cret-value",
    DATABASE_URL: "postgres://u:p@db:5432/quizdeck",
    BETTER_AUTH_URL: "https://myquizdeck.com",
  };

  it("필수 env 가 모두 있으면 missing 이 비고 값이 반영된다", () => {
    const cfg = resolveAuthConfig(full);
    expect(cfg.missing).toEqual([]);
    expect(cfg.secret).toBe("s3cret-value");
    expect(cfg.databaseUrl).toBe("postgres://u:p@db:5432/quizdeck");
    expect(cfg.baseURL).toBe("https://myquizdeck.com");
  });

  it("BETTER_AUTH_URL 이 없으면 baseURL 은 undefined (better-auth 가 요청 오리진으로 추론)", () => {
    const { BETTER_AUTH_URL, ...rest } = full;
    void BETTER_AUTH_URL;
    const cfg = resolveAuthConfig(rest);
    expect(cfg.baseURL).toBeUndefined();
    expect(cfg.missing).toEqual([]);
  });

  it("BETTER_AUTH_SECRET 누락은 missing 에 보고된다", () => {
    const { BETTER_AUTH_SECRET, ...rest } = full;
    void BETTER_AUTH_SECRET;
    const cfg = resolveAuthConfig(rest);
    expect(cfg.missing).toContain("BETTER_AUTH_SECRET");
    expect(cfg.secret).toBeUndefined();
  });

  it("DATABASE_URL 누락은 missing 에 보고된다", () => {
    const { DATABASE_URL, ...rest } = full;
    void DATABASE_URL;
    const cfg = resolveAuthConfig(rest);
    expect(cfg.missing).toContain("DATABASE_URL");
    expect(cfg.databaseUrl).toBeUndefined();
  });

  it("빈 문자열·공백 only 값은 없는 것으로 취급한다", () => {
    const cfg = resolveAuthConfig({ BETTER_AUTH_SECRET: "   ", DATABASE_URL: "" });
    expect(cfg.missing).toEqual(["BETTER_AUTH_SECRET", "DATABASE_URL"]);
    expect(cfg.secret).toBeUndefined();
    expect(cfg.databaseUrl).toBeUndefined();
  });
});

describe("assertAuthConfigReady", () => {
  it("missing 이 있으면 누락 키를 담아 throw 한다", () => {
    const cfg = resolveAuthConfig({});
    expect(() => assertAuthConfigReady(cfg)).toThrow(/BETTER_AUTH_SECRET/);
    expect(() => assertAuthConfigReady(cfg)).toThrow(/DATABASE_URL/);
  });

  it("완전한 config 는 통과한다", () => {
    const cfg = resolveAuthConfig({
      BETTER_AUTH_SECRET: "x",
      DATABASE_URL: "postgres://localhost/db",
    });
    expect(() => assertAuthConfigReady(cfg)).not.toThrow();
  });
});
