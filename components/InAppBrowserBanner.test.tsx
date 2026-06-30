// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

// detectInApp/buildEscapeTarget 는 모킹(순수 로직은 lib/in-app-browser.test 가 검증) — 배너의 분기만 본다.
const { detectInApp, buildEscapeTarget } = vi.hoisted(() => ({
  detectInApp: vi.fn(),
  buildEscapeTarget: vi.fn(),
}));
vi.mock("@/lib/in-app-browser", () => ({ detectInApp, buildEscapeTarget }));

import InAppBrowserBanner from "./InAppBrowserBanner";

// vitest globals 미설정 — auto-cleanup 이 안 도니 screen 누적 방지.
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("InAppBrowserBanner (인앱 웹뷰 안내 배너)", () => {
  it("인앱 웹뷰면 안내 + '기본 브라우저로 열기' 버튼 노출", () => {
    detectInApp.mockReturnValue({ isInApp: true, app: "kakaotalk", os: "android" });
    render(<InAppBrowserBanner />);
    expect(screen.getByText(/인앱 브라우저/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "기본 브라우저로 열기" })).toBeTruthy();
  });

  it("일반 브라우저면 아무것도 렌더하지 않음", () => {
    detectInApp.mockReturnValue({ isInApp: false, app: null, os: "ios" });
    const { container } = render(<InAppBrowserBanner />);
    expect(container.textContent).toBe("");
  });

  it("강제 불가(guide)면 클릭 시 수동 안내(Safari로 열기)로 전환", () => {
    detectInApp.mockReturnValue({ isInApp: true, app: "instagram", os: "ios" });
    buildEscapeTarget.mockReturnValue({ method: "guide" });
    render(<InAppBrowserBanner />);
    fireEvent.click(screen.getByRole("button", { name: "기본 브라우저로 열기" }));
    expect(screen.getByText(/Safari로 열기/)).toBeTruthy();
  });

  it("닫기(✕) 누르면 배너 사라짐", () => {
    detectInApp.mockReturnValue({ isInApp: true, app: "kakaotalk", os: "android" });
    render(<InAppBrowserBanner />);
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(screen.queryByText(/인앱 브라우저/)).toBeNull();
  });
});
