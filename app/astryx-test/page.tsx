"use client";

import { Theme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral/built";
import { Button } from "@astryxdesign/core/Button";

// ADR-0014 Phase 0 — astryx 통합 feasibility 게이트(임시 라우트, 마이그레이션 후 삭제).
// 검증: (1) CSS 3종 import 가 Next15/Tailwind v4 빌드에서 통과, (2) Theme+Button 렌더, (3) 전역
// astryx CSS 가 기존 앱을 깨지 않는지(다른 페이지 대조). 지금은 neutral 테마 그대로.
export default function AstryxTest() {
  return (
    <div style={{ padding: 24, maxWidth: 640, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 16, fontWeight: 700 }}>Astryx Phase 0 통합 테스트 (ADR-0014)</h1>
      <p style={{ marginBottom: 16, color: "var(--muted)" }}>
        아래는 astryx neutral 테마의 Button. quizdeck 다크 위에서 렌더되는지 확인.
      </p>
      <Theme theme={neutralTheme}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button label="Astryx Button" />
          <Button label="Secondary" variant="secondary" />
        </div>
      </Theme>
    </div>
  );
}
