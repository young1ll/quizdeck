// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// useSession 만 모킹(better-auth client 미로딩). isLearner 술어는 실제(lib/learner, 순수) 사용.
const { useSession } = vi.hoisted(() => ({ useSession: vi.fn() }));
vi.mock("@/lib/auth-client", () => ({ useSession, signOut: vi.fn() }));
// AccountChip 은 learner 메뉴 항목 내비에 useRouter 를 쓴다 — 테스트엔 App Router 컨텍스트가 없어 목킹.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import AccountChip from "./AccountChip";

// vitest globals 미설정이라 testing-library auto-cleanup 이 안 돈다 — screen(전역 DOM) 누적 방지.
afterEach(cleanup);
beforeEach(() => useSession.mockReset());

describe("AccountChip (learner shell 헤더 계정 칩)", () => {
  // ADR-0014 Phase 2: 검증 Learner 는 이름 트리거의 astryx DropdownMenu(마이페이지·로그아웃) — 직접
  // /me 링크가 아니다. 익명은 그대로 /login 링크. 여기선 트리거/링크의 접근성 라벨·역할을 검증한다.
  it("검증된 Learner 면 이름이 계정 메뉴 트리거(버튼)", () => {
    useSession.mockReturnValue({ data: { user: { id: "1", name: "홍길동", emailVerified: true } } });
    render(<AccountChip />);
    // 이름은 메뉴 트리거 버튼(링크 아님) — 마이페이지·로그아웃은 메뉴 항목.
    expect(screen.getByRole("button", { name: "홍길동" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "홍길동" })).toBeNull();
  });

  it("익명이면 로그인 링크(→/login, 슬라이스 C)", () => {
    useSession.mockReturnValue({ data: null });
    render(<AccountChip />);
    expect(screen.getByRole("link", { name: "로그인" }).getAttribute("href")).toBe("/login");
  });

  it("미검증 세션도 로그인 링크(아직 Learner 아님)", () => {
    useSession.mockReturnValue({ data: { user: { id: "1", name: "x", emailVerified: false } } });
    render(<AccountChip />);
    expect(screen.getByRole("link", { name: "로그인" }).getAttribute("href")).toBe("/login");
  });

  it("이름이 없으면 '마이페이지' 라벨로 폴백(메뉴 트리거)", () => {
    useSession.mockReturnValue({ data: { user: { id: "1", emailVerified: true } } });
    render(<AccountChip />);
    expect(screen.getByRole("button", { name: "마이페이지" })).toBeTruthy();
  });
});
