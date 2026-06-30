"use client";

import { useEffect, useState } from "react";
import { detectInApp, buildEscapeTarget, type InAppInfo } from "@/lib/in-app-browser";

const DISMISS_KEY = "quizdeck:inapp-dismissed";

// 인앱 웹뷰(카카오톡·네이버앱·인스타 등) 안내 배너 (#9 후속). 인앱 웹뷰에서는 네이버 앱 인증·패스키 등
// app-to-app 로그인이 막히므로 기본 브라우저로 탈출하도록 유도한다. 강제 가능한 플랫폼(Android·iOS
// 카카오톡·라인)은 버튼 한 번으로 외부 브라우저를 열고, 강제 불가(iOS 네이버앱·인스타)는 수동 안내한다.
// SSR(서버엔 navigator 없음) ↔ 클라 첫 렌더를 맞추려 mount 후에만 렌더(hydration mismatch 방지).
export default function InAppBrowserBanner() {
  const [info, setInfo] = useState<InAppInfo | null>(null);
  const [dismissed, setDismissed] = useState(true);
  const [guide, setGuide] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const i = detectInApp(navigator.userAgent);
    setInfo(i);
    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  if (!info?.isInApp || dismissed) return null;

  const openExternal = () => {
    const plan = buildEscapeTarget(window.location.href, info);
    if (plan.method === "navigate") {
      window.location.href = plan.href;
    } else {
      setGuide(true);
    }
  };

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard 차단 — 안내 텍스트로 충분 */
    }
  };

  return (
    <div
      className="sticky top-0 z-50 border-b border-[var(--warn)]/40 bg-[var(--panel)] px-4 py-2.5 text-sm"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.625rem)" }}
      role="alert"
    >
      <div className="mx-auto flex max-w-3xl items-start gap-3">
        <div className="min-w-0 flex-1">
          {!guide ? (
            <p className="leading-relaxed text-[var(--fg)]">
              📱 인앱 브라우저에서는 네이버 앱 인증·패스키 로그인이 제한됩니다. 기본 브라우저에서 열어주세요.
            </p>
          ) : (
            <p className="leading-relaxed text-[var(--fg)]">
              오른쪽 위(또는 아래) 메뉴 <span className="font-bold">⋯</span> 에서{" "}
              <span className="font-bold">‘Safari로 열기’</span>(또는 ‘다른 브라우저로 열기’)를 선택하세요.
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            {!guide ? (
              <button
                type="button"
                onClick={openExternal}
                className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[var(--accent-fg)]"
              >
                기본 브라우저로 열기
              </button>
            ) : (
              <button
                type="button"
                onClick={copyLink}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:border-[var(--accent)]"
              >
                {copied ? "복사됨 ✓" : "링크 복사"}
              </button>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="닫기"
          className="-mr-1 shrink-0 px-1 text-lg leading-none text-[var(--muted)] hover:text-[var(--fg)]"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
