import { defineTheme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral/built";

// quizdeck 브랜드 테마 (ADR-0014 Phase 0) — neutral 을 extends 하고 **핵심 시맨틱 색만** quizdeck 다크
// 팔레트(globals.css :root 토큰)로 오버라이드한다. 앱은 다크 전용이라 단일값(다크); 나머지 색·텍스트·
// radius·타이포는 neutral 다크모드를 상속한다(Theme mode="dark"). 90+ 전체 토큰 매핑이 아니라 브랜드
// 핵심만 — ADR-0014 "brand-preserve(팔레트 유지) + 컴포넌트 룩은 astryx" 원칙.
export const quizdeckTheme = defineTheme({
  name: "quizdeck",
  extends: neutralTheme,
  tokens: {
    "--color-accent": "#3b82f6", // --accent
    "--color-on-accent": "#ffffff", // --accent-fg
    "--color-background-body": "#0f1419", // --bg
    "--color-background-surface": "#0f1419", // --bg
    "--color-background-card": "#161d26", // --panel
    "--color-background-popover": "#161d26", // --panel
    "--color-background-muted": "#1c2530", // --panel-2
    "--color-border": "#29333f", // --border
    "--color-error": "#ef4444", // --bad
  },
});
