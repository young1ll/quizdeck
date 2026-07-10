import { describe, it, expect } from "vitest";
import { isAdminRole, isCmsRole } from "./admin";

// 순수 role 술어 — better-auth·DB 없이 off-stack 검증. isCmsRole 은 Payload admin(/cms) 접근
// 경계(ADR-0024): admin(운영 전체)·author(콘텐츠 저작 전용) 만 통과, 일반 user 는 거부.

describe("isCmsRole", () => {
  it("admin·author 를 통과시킨다", () => {
    expect(isCmsRole("admin")).toBe(true);
    expect(isCmsRole("author")).toBe(true);
  });

  it("일반 user·빈 값을 거부한다", () => {
    expect(isCmsRole("user")).toBe(false);
    expect(isCmsRole("")).toBe(false);
    expect(isCmsRole(null)).toBe(false);
    expect(isCmsRole(undefined)).toBe(false);
  });

  it("콤마 다중 role 을 isAdminRole 과 같은 규칙으로 처리한다", () => {
    expect(isCmsRole("user, author")).toBe(true);
    expect(isCmsRole("user,admin")).toBe(true);
    expect(isCmsRole("user, editor")).toBe(false);
    // 부분 문자열 오탐 금지 — "authority" 는 author 가 아니다
    expect(isCmsRole("authority")).toBe(false);
    expect(isAdminRole("administrator")).toBe(false);
  });
});
