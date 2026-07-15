"use client";

import * as React from "react";

// 페이지 전환 래퍼 — (learner) shell 이 본문({children})만 감싼다(헤더는 전환 밖, 정적).
// React 의 <ViewTransition> 은 Next 16 이 번들한 React canary(19.3)가 정식 이름으로 export 하지만
// 공개 npm react(19.2) 타입엔 아직 없어 런타임 조회로 얻는다. 없으면 children 그대로(무애니 폴백)
// — experimental.viewTransition 플래그를 꺼도 안전하다. 전환 룩은 globals.css 의 .vt-page 가 소유.
const ViewTransition = (React as Record<string, unknown>).ViewTransition as
  | React.ComponentType<{ default?: string; children: React.ReactNode }>
  | undefined;

export default function PageTransition({ children }: { children: React.ReactNode }) {
  if (!ViewTransition) return <>{children}</>;
  return <ViewTransition default="vt-page">{children}</ViewTransition>;
}
