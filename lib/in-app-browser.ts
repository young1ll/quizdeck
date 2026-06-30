// 인앱 브라우저(웹뷰) 감지 + 외부 브라우저 탈출 계산 (#9 후속, 모바일 소셜 로그인).
//
// 카카오톡·네이버앱·인스타그램 등의 **인앱 웹뷰**에서는 OAuth app-to-app(네이버 앱 인증·패스키)이
// 차단된다. 그래서 (1) 인앱 웹뷰를 user-agent 로 감지하고 (2) 가능한 플랫폼에서 기본 브라우저로
// 탈출시킨다. UA 파싱·탈출 URL 계산은 DOM·navigation 과 분리된 **순수 함수**로 두어 테스트한다 —
// 실제 navigation(location.href=…)·안내 표시는 호출부(배너·소셜 버튼)가 담당한다.

export type InAppApp = "kakaotalk" | "naver" | "facebook" | "instagram" | "line" | "other";
export type MobileOS = "ios" | "android" | "other";

export interface InAppInfo {
  /** 인앱 웹뷰로 판정됐는가(알려진 앱 토큰 또는 Android 일반 웹뷰 `; wv`). */
  isInApp: boolean;
  /** 판정된 인앱 앱(없으면 null). */
  app: InAppApp | null;
  os: MobileOS;
}

/** 외부 브라우저 탈출 계획 — navigate(강제 가능) 또는 guide(강제 불가, 수동 안내). */
export type EscapePlan = { method: "navigate"; href: string } | { method: "guide" };

/**
 * user-agent 로 인앱 웹뷰를 감지한다. iOS 일반 웹뷰는 식별 토큰이 없어(알려진 앱 토큰이 없으면)
 * 감지 못 하는 게 정상 — 잘못 강제 탈출시키지 않도록 알려진 앱 + Android 일반 웹뷰만 인앱으로 본다.
 */
export function detectInApp(ua: string): InAppInfo {
  const s = ua || "";
  const os: MobileOS = /iphone|ipad|ipod/i.test(s)
    ? "ios"
    : /android/i.test(s)
      ? "android"
      : "other";

  let app: InAppApp | null = null;
  if (/kakaotalk/i.test(s)) app = "kakaotalk";
  else if (/naver\(inapp/i.test(s)) app = "naver";
  else if (/FBAN|FBAV|FB_IAB/i.test(s)) app = "facebook";
  else if (/instagram/i.test(s)) app = "instagram";
  else if (/\bline\//i.test(s)) app = "line";
  else if (os === "android" && /;\s*wv\b/i.test(s)) app = "other"; // Android 일반 웹뷰

  return { isInApp: app !== null, app, os };
}

/**
 * 인앱 웹뷰에서 기본 브라우저로 탈출할 방법을 계산한다.
 * - Android: `intent://` 스킴 — 어느 인앱 웹뷰든 기본 브라우저로 핸드오프(스킴 https).
 * - iOS 카카오톡: `kakaotalk://web/openExternal` — Safari 로 연다(카카오 지원 스킴).
 * - iOS 라인: URL 에 `openExternalBrowser=1` — 라인이 외부 브라우저로 연다.
 * - 그 외 iOS(네이버앱·인스타·페북): 강제 불가 → 수동 안내(guide).
 */
export function buildEscapeTarget(url: string, info: InAppInfo): EscapePlan {
  if (info.os === "android") {
    const noScheme = url.replace(/^https?:\/\//i, "");
    return { method: "navigate", href: `intent://${noScheme}#Intent;scheme=https;end` };
  }
  if (info.os === "ios") {
    if (info.app === "kakaotalk") {
      return { method: "navigate", href: `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}` };
    }
    if (info.app === "line") {
      const sep = url.includes("?") ? "&" : "?";
      return { method: "navigate", href: `${url}${sep}openExternalBrowser=1` };
    }
    return { method: "guide" };
  }
  return { method: "guide" };
}
