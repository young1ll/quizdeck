"use client";

import { Theme } from "@astryxdesign/core/theme";
import { quizdeckTheme } from "@/lib/astryx-theme";

// astryx Theme provider (ADR-0014 Phase 1) — 앱 전역에 quizdeck 브랜드 테마 + 다크 강제. 루트
// layout 이 감싼다. mode="dark"(앱은 다크 전용). SSR 플래시는 <html data-theme="dark"> 로 보완.
export default function AstryxProvider({ children }: { children: React.ReactNode }) {
  return (
    <Theme theme={quizdeckTheme} mode="dark">
      {children}
    </Theme>
  );
}
