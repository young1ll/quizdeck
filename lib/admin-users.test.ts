import { describe, it, expect } from "vitest";
import { summarizeUsers, type AdminUser } from "./admin-users";

// summarizeUsers 순수 집계 (아키텍처 리뷰 admin-hub / ADR-0017). loadUsers 의 DB 조회는 통합 영역이라
// 여기선 순수 요약만 — 검증(Learner)·admin 카운트가 목록의 User→Learner 경계를 반영한다.

const u = (patch: Partial<AdminUser>): AdminUser => ({
  id: "u",
  email: "a@x.com",
  name: "n",
  verified: false,
  isAdmin: false,
  joined: "2026-07-01",
  ...patch,
});

describe("summarizeUsers", () => {
  it("전체·검증(Learner)·admin 을 센다", () => {
    const users = [
      u({ verified: true }),
      u({ verified: true, isAdmin: true }),
      u({ verified: false }), // 미인증 가입자 — Learner 아님
    ];
    expect(summarizeUsers(users)).toEqual({ total: 3, verified: 2, admins: 1 });
  });

  it("빈 목록은 0", () => {
    expect(summarizeUsers([])).toEqual({ total: 0, verified: 0, admins: 0 });
  });

  it("검증됐어도 admin 아니면 admins 에 안 센다", () => {
    expect(summarizeUsers([u({ verified: true }), u({ verified: true })]).admins).toBe(0);
  });
});
