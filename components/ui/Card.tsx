import { Card as AstryxCard, type CardProps } from "@astryxdesign/core/Card";

// 공통 카드 — astryx Card 래퍼 (A3). astryx Card 는 배경 variant(default·muted·blue…)만 갖고
// **테두리 강조**는 없어, 강조가 필요한 6곳이 Tailwind arbitrary(border-[var(--accent)]/40 등)로 astryx
// Card 를 덧칠했다 — 그러나 `@layer utilities` 가 astryx 레이어보다 앞이라 **캐스케이드에서 져 죽어**
// 있었다(라이브에서 회색 렌더). CardVariant 는 닫힌 union 이라 Button 처럼 커스텀 variant 로 테마에
// 흘릴 수도 없다. 그래서 어댑터가 강조를 **두 named intent + globals unlayered CSS**(`.astryx-card.card-*`,
// astryx 레이어를 이김 — app/globals.css)로 실현한다:
//  · emphasis="accent"|"warn" — 지속 강조 테두리(정적 call-out, /40 은은).
//  · interactive — 클릭 카드(Link 래핑)의 hover 강조 테두리.
// 호출부는 <Card emphasis="accent">·<Card interactive> 로 표현하고, 나머지 CardProps(padding·variant
// ·width…)는 그대로 forward. 죽어 있던 Tailwind override 를 걷어내 룩이 우리 CSS 로 흐른다.
type Emphasis = "accent" | "warn";

const EMPHASIS_CLASS: Record<Emphasis, string> = {
  accent: "card-emph-accent",
  warn: "card-emph-warn",
};
const INTERACTIVE_CLASS = "card-interactive";

export function Card({
  emphasis,
  interactive = false,
  className = "",
  ...rest
}: CardProps & { emphasis?: Emphasis; interactive?: boolean }) {
  const extra = [emphasis ? EMPHASIS_CLASS[emphasis] : "", interactive ? INTERACTIVE_CLASS : ""]
    .filter(Boolean)
    .join(" ");
  const merged = `${extra}${extra && className ? " " : ""}${className}`.trim();
  return <AstryxCard className={merged || undefined} {...rest} />;
}
