// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

import { Field } from "./Field";

// Field 어댑터 (A1) — astryx TextInput 위에서 우리 시그니처를 보존. 가장 부서지기 쉬운 계약은
// **native 검증 attr(required/minLength/autoComplete)이 astryx 타입 표면 밖인데도 ...rest 로 <input>
// 에 흘러가는지**다(브라우저 검증·비번관리자). Beta 업그레이드가 이 cast-through 를 조용히 깨면 여기서 잡힌다.
afterEach(cleanup);

describe("Field 어댑터 (astryx TextInput 위 우리 시그니처)", () => {
  it("native 검증 attr(required·minLength·autoComplete)이 <input> 에 전달", () => {
    render(
      <Field
        label="이메일"
        type="email"
        value=""
        onChange={() => {}}
        autoComplete="email"
        minLength={5}
        required
      />,
    );
    const input = screen.getByLabelText("이메일") as HTMLInputElement;
    expect(input.required).toBe(true);
    expect(input.getAttribute("minlength")).toBe("5");
    expect(input.getAttribute("autocomplete")).toBe("email");
    expect(input.type).toBe("email");
  });

  it("onChange 는 값(string)으로 좁혀 호출된다", () => {
    const onChange = vi.fn();
    render(<Field label="이름" value="" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("이름"), { target: { value: "홍길동" } });
    expect(onChange).toHaveBeenCalledWith("홍길동");
  });
});
