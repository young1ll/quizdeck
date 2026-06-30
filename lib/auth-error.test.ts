import { describe, it, expect } from "vitest";
import { authErrorMessage } from "./auth-error";

// better-auth 에러 정규화 (리뷰 C6). 핵심 보장: 라이브러리 영어 message 를 절대 노출하지 않고
// 항상 한국어(알려진 코드 → 특정 한국어, 그 외 → 컨텍스트 fallback)를 돌려준다.
describe("authErrorMessage", () => {
  it("에러가 없으면 null (콜러는 성공 처리)", () => {
    expect(authErrorMessage({}, "fallback")).toBeNull();
    expect(authErrorMessage({ error: null }, "fallback")).toBeNull();
  });

  it("알려진 코드는 특정 한국어로 매핑한다", () => {
    expect(authErrorMessage({ error: { code: "INVALID_EMAIL_OR_PASSWORD" } }, "fb")).toBe(
      "이메일 또는 비밀번호가 올바르지 않습니다.",
    );
    expect(authErrorMessage({ error: { code: "USER_ALREADY_EXISTS" } }, "fb")).toBe(
      "이미 가입된 이메일입니다.",
    );
    expect(authErrorMessage({ error: { code: "INVALID_PASSWORD" } }, "fb")).toBe(
      "현재 비밀번호가 올바르지 않습니다.",
    );
  });

  it("모르는 코드/코드 없음은 fallback — 영어 message 를 절대 노출하지 않는다", () => {
    expect(
      authErrorMessage({ error: { code: "WEIRD_CODE", message: "Some English error" } }, "한국어 폴백"),
    ).toBe("한국어 폴백");
    expect(authErrorMessage({ error: { message: "Internal English message" } }, "한국어 폴백")).toBe(
      "한국어 폴백",
    );
  });
});
