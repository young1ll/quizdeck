import type { ReactNode } from "react";
import { Text } from "@astryxdesign/core/Text";

// 통계 타일 — astryx Text 타이포 + panel 서피스 얇은 래퍼 (ADR-0014 Phase 1, ADR-0007 결정 1 · #43 계승).
// 컴포넌트 룩(큰 숫자 b + 작은 라벨 s)은 astryx Text 언어로: b=base/bold, s=4xs/secondary(≈muted).
// 서피스(rounded-control · panel-2)와 패딩(className)은 Tailwind 유지 — 레이아웃 공존(ADR-0014 결정 4).
// Home(연습 통계)·Dashboard(학습 현황)가 공유하고 패딩만 className 으로 다르다(Home p-2, Dashboard py-2).
// b 는 문자열/숫자(예: "12/40" · "🔥3" · 오답수) — Text 가 그대로 렌더한다.
// display="block" 필수 — astryx Text 는 StyleX 로 display:inline 이라, 없으면 숫자·라벨이 세로로 안 쌓이고
// 나란히 흐른다(부모 grid 의 text-center 로 가운데 정렬). — ADR-0014 시각 보정.
export function StatTile({
  b,
  s,
  className = "p-2",
}: {
  b: ReactNode;
  s: string;
  className?: string;
}) {
  return (
    <div className={`rounded-control bg-[var(--panel-2)] ${className}`.trim()}>
      <Text as="div" display="block" size="base" weight="bold">
        {b}
      </Text>
      <Text as="div" display="block" size="4xs" color="secondary">
        {s}
      </Text>
    </div>
  );
}
