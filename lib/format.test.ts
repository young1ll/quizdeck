import { describe, it, expect } from "vitest";
import { normalizeEmail } from "./format";

describe("normalizeEmail", () => {
  it("앞뒤 공백을 떼고 소문자화한다", () => {
    expect(normalizeEmail("  Foo@Example.COM  ")).toBe("foo@example.com");
  });

  it("이미 정규화된 값은 그대로", () => {
    expect(normalizeEmail("a@b.com")).toBe("a@b.com");
  });
});
