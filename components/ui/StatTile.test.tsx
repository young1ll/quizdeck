// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import { StatTile } from "./StatTile";

// StatTile 어댑터 (A1) — 계약이 시각(astryx Text 를 display=block 로 세로 스택)이라 jsdom 에서 계산
// 스타일을 못 재므로 의미 단언은 약하다. 여기선 **큰 숫자(b)와 작은 라벨(s)이 둘 다 렌더**되는지만
// smoke 로 확인한다(세로 스택 자체는 /verify 시각 검증). b 는 문자열/숫자/노드 모두 허용.
afterEach(cleanup);

describe("StatTile 어댑터 (숫자 b + 라벨 s)", () => {
  it("b·s 둘 다 렌더", () => {
    render(<StatTile b="12/40" s="정답률" />);
    expect(screen.getByText("12/40")).toBeTruthy();
    expect(screen.getByText("정답률")).toBeTruthy();
  });
});
