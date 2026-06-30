import { describe, it, expect } from "vitest";
import { detectInApp, buildEscapeTarget } from "./in-app-browser";

// 대표 user-agent (실측 기반 발췌).
const UA = {
  kakaoAndroid:
    "Mozilla/5.0 (Linux; Android 13; SM-S908N Build/TP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/116.0.0.0 Mobile Safari/537.36 KAKAOTALK 10.4.5",
  kakaoIOS:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.4.5",
  naverIOS:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 NAVER(inapp; search; 2000; 12.4.5)",
  naverAndroid:
    "Mozilla/5.0 (Linux; Android 13; SM-S908N; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/116.0.0.0 Mobile Safari/537.36 NAVER(inapp; search; 1000; 12.4.5)",
  instagramIOS:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 302.0.0.0 (iPhone14,5; iOS 16_6; ko_KR)",
  lineIOS:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Line/13.5.0",
  safariIOS:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
  chromeAndroid:
    "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36",
  chromeDesktop:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36",
};

describe("detectInApp — 인앱 웹뷰 감지", () => {
  it("카카오톡(Android/iOS)을 인앱으로 판정", () => {
    expect(detectInApp(UA.kakaoAndroid)).toEqual({ isInApp: true, app: "kakaotalk", os: "android" });
    expect(detectInApp(UA.kakaoIOS)).toEqual({ isInApp: true, app: "kakaotalk", os: "ios" });
  });
  it("네이버앱(inapp 토큰)을 인앱으로 판정", () => {
    expect(detectInApp(UA.naverIOS)).toEqual({ isInApp: true, app: "naver", os: "ios" });
    expect(detectInApp(UA.naverAndroid)).toEqual({ isInApp: true, app: "naver", os: "android" });
  });
  it("인스타그램·라인을 인앱으로 판정", () => {
    expect(detectInApp(UA.instagramIOS).app).toBe("instagram");
    expect(detectInApp(UA.lineIOS).app).toBe("line");
  });
  it("일반 브라우저(모바일 Safari·Android Chrome·데스크톱)는 인앱 아님", () => {
    expect(detectInApp(UA.safariIOS).isInApp).toBe(false);
    expect(detectInApp(UA.chromeAndroid).isInApp).toBe(false); // `; wv` 없음
    expect(detectInApp(UA.chromeDesktop).isInApp).toBe(false);
  });
  it("빈 UA 는 인앱 아님", () => {
    expect(detectInApp("")).toEqual({ isInApp: false, app: null, os: "other" });
  });
});

describe("buildEscapeTarget — 외부 브라우저 탈출", () => {
  it("Android 는 intent:// 로 강제(스킴 https)", () => {
    const plan = buildEscapeTarget("https://myquizdeck.com/login", detectInApp(UA.kakaoAndroid));
    expect(plan).toEqual({
      method: "navigate",
      href: "intent://myquizdeck.com/login#Intent;scheme=https;end",
    });
  });
  it("iOS 카카오톡은 kakaotalk openExternal 스킴", () => {
    const plan = buildEscapeTarget("https://myquizdeck.com/login", detectInApp(UA.kakaoIOS));
    expect(plan).toEqual({
      method: "navigate",
      href: "kakaotalk://web/openExternal?url=" + encodeURIComponent("https://myquizdeck.com/login"),
    });
  });
  it("iOS 라인은 openExternalBrowser=1 파라미터(기존 쿼리 보존)", () => {
    expect(buildEscapeTarget("https://x.com/a", detectInApp(UA.lineIOS))).toEqual({
      method: "navigate",
      href: "https://x.com/a?openExternalBrowser=1",
    });
    expect(buildEscapeTarget("https://x.com/a?b=1", detectInApp(UA.lineIOS))).toEqual({
      method: "navigate",
      href: "https://x.com/a?b=1&openExternalBrowser=1",
    });
  });
  it("iOS 네이버앱·인스타는 강제 불가 → guide", () => {
    expect(buildEscapeTarget("https://x.com/a", detectInApp(UA.naverIOS))).toEqual({ method: "guide" });
    expect(buildEscapeTarget("https://x.com/a", detectInApp(UA.instagramIOS))).toEqual({ method: "guide" });
  });
});
