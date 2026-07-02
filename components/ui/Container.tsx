import type { ReactNode } from "react";

// 일관 반응형 container (ADR-0010 결정 7). mobile-first — 좌우 px 기본, 섹션이 size 로 폭만 조정한다.
// 화면마다 max-w 가 제각각이던 걸 수렴한다(home=lg 넓게, /me=sm 좁게, 학습=md 기본).
//
// ADR-0014 Phase 1 검토: 순수 레이아웃 프리미티브(중앙정렬·브랜드 max-width IA·반응형 px)라 Tailwind 로
// 유지한다 — 결정 4(Tailwind 는 레이아웃으로 astryx 와 공존) + 결정 2(브랜드/IA 유지)에 해당. astryx
// 등가(Section·Center)는 브랜드 폭 토큰(lg/2xl/3xl) 시맨틱을 못 담아 강제 전환은 이득 없음.
const SIZE = { sm: "max-w-lg", md: "max-w-2xl", lg: "max-w-3xl" } as const;

export function Container({
  size = "md",
  className = "",
  children,
}: {
  size?: keyof typeof SIZE;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`mx-auto w-full ${SIZE[size]} px-4 sm:px-6${className ? " " + className : ""}`}>
      {children}
    </div>
  );
}
