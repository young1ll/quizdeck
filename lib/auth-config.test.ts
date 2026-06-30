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

  // 패스키(WebAuthn, #10) — rpID·origin 은 baseURL 에서 파생한다(별도 env 없이 단일 소스).
  // 미지정이면 undefined → passkey 플러그인 기본(rpID "localhost", origin 은 클라이언트가 전달).
  it("baseURL 에서 rpID(호스트명)·origin 을 파생한다", () => {
    const cfg = resolveAuthConfig(full);
    expect(cfg.rpID).toBe("myquizdeck.com");
    expect(cfg.origin).toBe("https://myquizdeck.com");
  });

  it("trailing slash·경로가 있어도 origin 은 스킴+호스트(+포트)만, rpID 는 호스트명", () => {
    const cfg = resolveAuthConfig({ ...full, BETTER_AUTH_URL: "https://myquizdeck.com/app/" });
    expect(cfg.rpID).toBe("myquizdeck.com");
    expect(cfg.origin).toBe("https://myquizdeck.com");
  });

  it("로컬(포트 포함)은 rpID=localhost, origin 에 포트 보존", () => {
    const cfg = resolveAuthConfig({ ...full, BETTER_AUTH_URL: "http://localhost:3000" });
    expect(cfg.rpID).toBe("localhost");
    expect(cfg.origin).toBe("http://localhost:3000");
  });

  it("baseURL 이 없으면 rpID·origin 은 undefined (플러그인 기본에 위임)", () => {
    const { BETTER_AUTH_URL, ...rest } = full;
    void BETTER_AUTH_URL;
    const cfg = resolveAuthConfig(rest);
    expect(cfg.rpID).toBeUndefined();
    expect(cfg.origin).toBeUndefined();
  });

  it("잘못된 baseURL 은 rpID·origin 을 undefined 로 둔다(throw 하지 않음)", () => {
    const cfg = resolveAuthConfig({ ...full, BETTER_AUTH_URL: "not-a-url" });
    expect(cfg.rpID).toBeUndefined();
    expect(cfg.origin).toBeUndefined();
    expect(cfg.missing).toEqual([]); // 해석기는 throw 하지 않는다
  });

  // 소셜 로그인(V4, #9) — GitHub·Google·Naver 의 client id/secret 은 모두 선택(optional).
  // 외부 앱 등록이 선행돼야 하므로 미주입이 정상 상태 — missing 에 넣지 않고, 양쪽(id+secret)이
  // 모두 있을 때만 그 provider 를 enable 한다(부분 설정은 미구성으로 취급). git 밖 k8s Secret 주입.
  const withSocial = {
    ...full,
    GITHUB_CLIENT_ID: "gh-id",
    GITHUB_CLIENT_SECRET: "gh-secret",
    GOOGLE_CLIENT_ID: "goog-id",
    GOOGLE_CLIENT_SECRET: "goog-secret",
    NAVER_CLIENT_ID: "naver-id",
    NAVER_CLIENT_SECRET: "naver-secret",
  };

  it("세 provider 의 id+secret 가 모두 있으면 social 에 셋 다 채워진다", () => {
    const cfg = resolveAuthConfig(withSocial);
    expect(cfg.social.github).toEqual({ clientId: "gh-id", clientSecret: "gh-secret" });
    expect(cfg.social.google).toEqual({ clientId: "goog-id", clientSecret: "goog-secret" });
    expect(cfg.social.naver).toEqual({ clientId: "naver-id", clientSecret: "naver-secret" });
  });

  it("소셜 env 가 전혀 없으면 social 은 빈 객체이고 missing 에 들어가지 않는다", () => {
    const cfg = resolveAuthConfig(full);
    expect(cfg.social).toEqual({});
    expect(cfg.missing).toEqual([]);
  });

  it("id 만 있고 secret 이 없으면 그 provider 는 미구성(undefined)으로 둔다", () => {
    const cfg = resolveAuthConfig({ ...full, GITHUB_CLIENT_ID: "gh-id" });
    expect(cfg.social.github).toBeUndefined();
    expect(cfg.missing).toEqual([]); // 부분 설정도 인증 전체를 막지 않는다
  });

  it("일부 provider 만 구성되면 그 provider 만 enable 된다", () => {
    const cfg = resolveAuthConfig({
      ...full,
      GITHUB_CLIENT_ID: "gh-id",
      GITHUB_CLIENT_SECRET: "gh-secret",
    });
    expect(cfg.social.github).toEqual({ clientId: "gh-id", clientSecret: "gh-secret" });
    expect(cfg.social.google).toBeUndefined();
    expect(cfg.social.naver).toBeUndefined();
  });

  it("소셜 자격증명의 공백 only 값은 미설정으로 취급한다", () => {
    const cfg = resolveAuthConfig({
      ...full,
      GOOGLE_CLIENT_ID: "  ",
      GOOGLE_CLIENT_SECRET: "goog-secret",
    });
    expect(cfg.social.google).toBeUndefined();
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
