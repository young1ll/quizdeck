import type { ReactNode } from "react";

// 일관 반응형 container (ADR-0010 결정 7). mobile-first — 좌우 px 기본, 섹션이 size 로 폭만 조정한다.
// 화면마다 max-w 가 제각각이던 걸 수렴한다(home=lg 넓게, /me=sm 좁게, 학습=md 기본).
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
