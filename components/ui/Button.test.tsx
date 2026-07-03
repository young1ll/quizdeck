// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import { Button } from "./Button";

// components/ui/* 어댑터 seam 테스트 (A1) — 우리 호출부 어휘를 astryx 로 번역하는 계약을
// render-through-astryx 로 핀한다(StyleX 해시가 아니라 안정 신호 = role·data-variant·className 토큰).
// AccountChip.test 패턴: vitest globals 미설정이라 auto-cleanup 이 안 돌아 afterEach(cleanup).
afterEach(cleanup);

describe("Button 어댑터 (우리 variant ⇄ astryx)", () => {
  // 회귀 핀 — dangerOutline 과 danger 가 둘 다 destructive 로 붕괴하던 버그(ADR-0014 리스킨).
  // dangerOutline 은 이제 진짜 astryx 커스텀 variant(A1 Path-B) — 자기 data-variant 로 렌더되고
  // solid destructive 와 **구별**된다(룩은 lib/astryx-theme.ts components.button 이 공급).
  // 두 실제 호출부: MyPage 회원 탈퇴 트리거 · Stats 데이터 초기화.
  it("dangerOutline ≠ danger — 붕괴 회귀 핀", () => {
    render(<Button variant="dangerOutline">초기화</Button>);
    const b = screen.getByRole("button", { name: "초기화" });
    expect(b.getAttribute("data-variant")).toBe("dangerOutline");
    expect(b.getAttribute("data-variant")).not.toBe("destructive");
  });

  it("danger 는 solid destructive — outline 아님", () => {
    render(<Button variant="danger">삭제</Button>);
    const b = screen.getByRole("button", { name: "삭제" });
    expect(b.getAttribute("data-variant")).toBe("destructive");
    expect(b.className).not.toContain("border-[var(--bad)]");
  });

  it("variant 매핑 — primary→primary · outline→secondary", () => {
    render(
      <>
        <Button variant="primary">확인</Button>
        <Button variant="outline">취소</Button>
      </>,
    );
    expect(screen.getByRole("button", { name: "확인" }).getAttribute("data-variant")).toBe("primary");
    expect(screen.getByRole("button", { name: "취소" }).getAttribute("data-variant")).toBe("secondary");
  });

  it("string children → 접근명(label), 기본 type=button", () => {
    render(<Button>저장</Button>);
    const b = screen.getByRole("button", { name: "저장" });
    expect(b.getAttribute("type")).toBe("button");
  });
});
