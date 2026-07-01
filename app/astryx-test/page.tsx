"use client";

import { Theme } from "@astryxdesign/core/theme";
import { Button } from "@astryxdesign/core/Button";
import { quizdeckTheme } from "@/lib/astryx-theme";

// ADR-0014 Phase 0 — astryx 통합 feasibility 게이트(임시 라우트, 마이그레이션 후 삭제).
// 브랜드 매핑 검증: quizdeckTheme(neutral extends + quizdeck 다크 토큰) + Theme mode="dark" 로
// astryx Button 이 quizdeck 브랜드(accent blue·다크 표면)로 렌더되는지.
export default function AstryxTest() {
  return (
    <div style={{ padding: 24, maxWidth: 640, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 16, fontWeight: 700 }}>Astryx Phase 0 — 브랜드 매핑 (ADR-0014)</h1>
      <p style={{ marginBottom: 16, color: "var(--muted)" }}>
        quizdeckTheme(neutral extends + quizdeck 토큰) · Theme mode=&quot;dark&quot;.
      </p>
      <Theme theme={quizdeckTheme} mode="dark">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button label="Primary" variant="primary" />
          <Button label="Secondary" variant="secondary" />
          <Button label="Ghost" variant="ghost" />
          <Button label="Destructive" variant="destructive" />
        </div>
      </Theme>
    </div>
  );
}
