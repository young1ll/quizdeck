import { describe, it, expect } from "vitest";
import { isLearner, learnerId } from "./learner";

// Learner 신원 술어 (ADR-0004 애던덤 / 아키텍처 리뷰 C1). 정규 술어 = emailVerified.
// admin.ts 의 isAdminRole 대칭 — 순수 함수라 better-auth·DB 없이 off-stack 으로 검증한다.
// 클라 게이트·store 선택·서버 가드가 전부 이 한 술어를 공유한다(드리프트 종결).
describe("isLearner / learnerId", () => {
  it("검증된 세션은 Learner — emailVerified true → id", () => {
    const s = { user: { id: "u1", email: "a@b.com", emailVerified: true } };
    expect(isLearner(s)).toBe(true);
    expect(learnerId(s)).toBe("u1");
  });

  it("미검증 세션은 Learner 아님 — id 가 있어도 null (id-존재가 아니라 검증을 본다)", () => {
    const s = { user: { id: "u1", email: "a@b.com", emailVerified: false } };
    expect(isLearner(s)).toBe(false);
    expect(learnerId(s)).toBeNull();
  });

  it("세션 없음(익명)은 Learner 아님", () => {
    expect(isLearner(null)).toBe(false);
    expect(isLearner(undefined)).toBe(false);
    expect(learnerId(null)).toBeNull();
    expect(learnerId(undefined)).toBeNull();
  });

  it("emailVerified 누락은 미검증으로 취급한다 (=== true 만 통과)", () => {
    const s = { user: { id: "u1", email: "a@b.com" } };
    expect(isLearner(s)).toBe(false);
    expect(learnerId(s)).toBeNull();
  });

  it("user 없는 세션도 안전(throw 없음)", () => {
    expect(isLearner({})).toBe(false);
    expect(learnerId({})).toBeNull();
  });
});
