// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import { Msg } from "./Msg";

// Msg 어댑터 (A1) — bad/good → astryx FieldStatus error/success. 계약의 핵심은 **role 시맨틱 보존**:
// bad=role=alert, good=role=status(+ astryx 가 aria-live 를 얹음). 리스킨이 이 매핑을 뒤집으면
// 스크린리더가 에러를 안 읽거나 잘못 읽는다 — 여기서 핀한다.
afterEach(cleanup);

describe("Msg 어댑터 (bad/good → FieldStatus error/success)", () => {
  it("bad → role=alert", () => {
    render(<Msg kind="bad">비밀번호가 틀렸습니다</Msg>);
    expect(screen.getByRole("alert").textContent).toContain("비밀번호가 틀렸습니다");
  });

  it("good → role=status", () => {
    render(<Msg kind="good">저장되었습니다</Msg>);
    expect(screen.getByRole("status").textContent).toContain("저장되었습니다");
  });
});
