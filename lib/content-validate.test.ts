import { describe, it, expect } from "vitest";
import { isValidQuestion, isValidConcept } from "./content-validate";

// 콘텐츠 경계 검증 — DB 없이(순수) 도메인 불변식을 핀한다(아키텍처 리뷰 route-guards). 옛날엔 admin/content
// 라우트 안 unexported 라 answer ⊂ options 같은 가장 로직 밀도 높은 규칙이 DB 통합 테스트로만 커버됐다.

const q = (patch: Record<string, unknown> = {}) => ({
  qn: 1,
  q: "질문",
  topic: "t",
  options: { A: "a", B: "b" },
  answer: ["A"],
  ...patch,
});

describe("isValidQuestion", () => {
  it("정답 ⊂ options 키 + 필수 필드면 true", () => {
    expect(isValidQuestion(q())).toBe(true);
    expect(isValidQuestion(q({ answer: ["A", "B"] }))).toBe(true);
  });

  it("정답이 options 키에 없으면 false (핵심 불변식)", () => {
    expect(isValidQuestion(q({ answer: ["C"] }))).toBe(false);
    expect(isValidQuestion(q({ answer: ["A", "Z"] }))).toBe(false);
  });

  it("qn 이 양의 정수 아니면 false (PK)", () => {
    expect(isValidQuestion(q({ qn: 0 }))).toBe(false);
    expect(isValidQuestion(q({ qn: 1.5 }))).toBe(false);
    expect(isValidQuestion(q({ qn: "1" }))).toBe(false);
  });

  it("빈 질문·빈 options·빈 answer·비문자열 보기값이면 false", () => {
    expect(isValidQuestion(q({ q: "  " }))).toBe(false);
    expect(isValidQuestion(q({ options: {} }))).toBe(false);
    expect(isValidQuestion(q({ answer: [] }))).toBe(false);
    expect(isValidQuestion(q({ options: { A: 1 } }))).toBe(false);
  });

  it("객체 아니면 false", () => {
    expect(isValidQuestion(null)).toBe(false);
    expect(isValidQuestion("x")).toBe(false);
  });
});

describe("isValidConcept", () => {
  const c = (patch: Record<string, unknown> = {}) => ({
    cat: "c",
    svc: "S3",
    deff: "d",
    key: "k",
    when: "w",
    trap: "t",
    vs: "v",
    ...patch,
  });
  it("필수 필드가 모두 비지 않은 문자열이면 true", () => {
    expect(isValidConcept(c())).toBe(true);
  });
  it("필수 필드 하나라도 없거나 빈 문자열이면 false", () => {
    expect(isValidConcept(c({ svc: "" }))).toBe(false);
    const { deff: _omit, ...noDeff } = c();
    expect(isValidConcept(noDeff)).toBe(false);
  });
});
