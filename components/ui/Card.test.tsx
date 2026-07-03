// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

import { Card } from "./Card";

// Card 어댑터 (A3) — emphasis/interactive intent 를 astryx Card 위에서 우리 어휘로 번역한다.
// 강조 룩은 globals.css 의 unlayered `.astryx-card.card-*`(astryx 레이어를 이김). 어댑터는 그 stable
// 클래스를 방출하고 나머지 CardProps 를 forward한다. seam 계약(intent → 클래스 · forward)을 핀한다.
// (죽은 Tailwind arbitrary override 를 대체 — 라이브에서 강조가 캐스케이드에 져 회색이던 걸 살렸다.)
afterEach(cleanup);

const card = (el: HTMLElement) => el.querySelector(".astryx-card") as HTMLElement;

describe("Card 어댑터 (astryx Card 위 emphasis/interactive)", () => {
  it("emphasis=accent|warn → 강조 클래스", () => {
    const a = render(<Card emphasis="accent">x</Card>);
    expect(card(a.container).className).toContain("card-emph-accent");
    const w = render(<Card emphasis="warn">x</Card>);
    expect(card(w.container).className).toContain("card-emph-warn");
  });

  it("interactive → card-interactive", () => {
    const { container } = render(<Card interactive>x</Card>);
    expect(card(container).className).toContain("card-interactive");
  });

  it("plain Card 는 강조 클래스 없음 (회귀 방지)", () => {
    const { container } = render(<Card>x</Card>);
    const cls = card(container).className;
    expect(cls).not.toContain("card-emph");
    expect(cls).not.toContain("card-interactive");
  });

  it("CardProps(variant·className) forward + intent 병합", () => {
    const { container } = render(
      <Card variant="muted" interactive className="mt-2">
        x
      </Card>,
    );
    const c = card(container);
    expect(c.getAttribute("data-variant")).toBe("muted"); // variant forward
    expect(c.className).toContain("mt-2"); // 사용자 className 보존
    expect(c.className).toContain("card-interactive"); // intent 병합
  });
});
