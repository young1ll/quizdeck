// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// useSession 만 모킹(better-auth client 미로딩). isLearner 술어는 실제(lib/learner, 순수) 사용.
const { useSession } = vi.hoisted(() => ({ useSession: vi.fn() }));
vi.mock("@/lib/auth-client", () => ({ useSession }));

import AccountChip from "./AccountChip";

beforeEach(() => useSession.mockReset());

describe("AccountChip (learner shell 헤더 계정 칩)", () => {
  it("검증된 Learner 면 이름→/me 링크", () => {
    useSession.mockReturnValue({ data: { user: { id: "1", name: "홍길동", emailVerified: true } } });
    render(<AccountChip />);
    expect(screen.getByRole("link", { name: "홍길동" }).getAttribute("href")).toBe("/me");
  });

  it("익명/미검증이면 아무것도 렌더하지 않는다(로그인은 home·게이트가 소유)", () => {
    useSession.mockReturnValue({ data: null });
    expect(render(<AccountChip />).container.firstChild).toBeNull();
    useSession.mockReturnValue({ data: { user: { id: "1", name: "x", emailVerified: false } } });
    expect(render(<AccountChip />).container.firstChild).toBeNull();
  });

  it("이름이 없으면 '마이페이지' 라벨로 폴백", () => {
    useSession.mockReturnValue({ data: { user: { id: "1", emailVerified: true } } });
    render(<AccountChip />);
    expect(screen.getByRole("link", { name: "마이페이지" }).getAttribute("href")).toBe("/me");
  });
});
