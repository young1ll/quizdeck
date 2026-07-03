import { defineTheme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral/built";

// quizdeck 브랜드 테마 (ADR-0014 Phase 0) — neutral 을 extends 하고 **핵심 시맨틱 색만** quizdeck 다크
// 팔레트로 오버라이드한다. 앱은 다크 전용이라 단일값(다크); 나머지 색·텍스트·radius·타이포는 neutral
// 다크모드를 상속한다(Theme mode="dark"). 90+ 전체 토큰 매핑이 아니라 브랜드 핵심만 — ADR-0014
// "brand-preserve(팔레트 유지) + 컴포넌트 룩은 astryx" 원칙.
//
// 브랜드 색의 유일 출처는 globals.css :root 다(SSOT, A2). 여기선 hex 사본 대신 그 var 를 참조한다 —
// defineTheme 은 토큰 값을 as-is 로 방출(resolveTokenValue passthrough)하므로 astryx 런타임 CSS 가
// `--color-accent: var(--accent)` 로 깔려 :root 값으로 해석된다. globals 에서 --accent 를 바꾸면 astryx
// 쪽이 자동 추종 — 두 곳에 박힌 hex(표류 위험)가 사라진다.
export const quizdeckTheme = defineTheme({
  name: "quizdeck",
  extends: neutralTheme,
  tokens: {
    "--color-accent": "var(--accent)",
    "--color-on-accent": "var(--accent-fg)",
    "--color-background-body": "var(--bg)",
    "--color-background-surface": "var(--bg)",
    "--color-background-card": "var(--panel)",
    "--color-background-popover": "var(--panel)",
    "--color-background-muted": "var(--panel-2)",
    "--color-border": "var(--border)",
    "--color-error": "var(--bad)",
  },
  // dangerOutline = astryx 커스텀 variant (A1 Path-B 승격). astryx 엔 outline-destructive 내장이 없어,
  // ButtonVariantMap augmentation(types/astryx.d.ts)으로 variant 를 등록하고 룩을 여기서 준다. 커스텀
  // variant 는 Button 의 하드코드 variants[] 에 없어(StyleX no-op) 전 표면을 이 override 가 공급한다:
  // 투명 배경 + bad 테두리/텍스트. 셀렉터는 `.astryx-button.dangerOutline`(parseStyleKey) — 렌더 요소의
  // themeProps 클래스와 일치. A1 의 Tailwind-on-astryx override(border-[var(--bad)])를 대체 → 룩이
  // astryx 언어로 흐른다(A2/A3 결).
  components: {
    button: {
      "variant:dangerOutline": {
        backgroundColor: "transparent",
        borderWidth: "1px",
        borderStyle: "solid",
        borderColor: "var(--bad)",
        color: "var(--bad)",
        ":hover": {
          backgroundColor: "color-mix(in srgb, var(--bad) 8%, transparent)",
        },
      },
    },
  },
});
