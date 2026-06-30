// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// useSession 만 모킹(better-auth client 미로딩). isLearner 술어는 실제(lib/learner, 순수) 사용.
const { useSession } = vi.hoisted(() => ({ useSession: vi.fn() }));
vi.mock("@/lib/auth-client", () => ({ useSession }));

import AccountChip from "./AccountChip";

// vitest globals 미설정이라 testing-library auto-cleanup 이 안 돈다 — screen(전역 DOM) 누적 방지.
afterEach(cleanup);
beforeEach(() => useSession.mockReset());

describe("AccountChip (learner shell 헤더 계정 칩)", () => {
  it("검증된 Learner 면 이름→/me 링크", () => {
    useSession.mockReturnValue({ data: { user: { id: "1", name: "홍길동", emailVerified: true } } });
    render(<AccountChip />);
    expect(screen.getByRole("link", { name: "홍길동" }).getAttribute("href")).toBe("/me");
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

  it("이름이 없으면 '마이페이지' 라벨로 폴백", () => {
    useSession.mockReturnValue({ data: { user: { id: "1", emailVerified: true } } });
    render(<AccountChip />);
    expect(screen.getByRole("link", { name: "마이페이지" }).getAttribute("href")).toBe("/me");
  });
});
