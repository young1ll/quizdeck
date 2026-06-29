import type { ButtonHTMLAttributes } from "react";

// 공통 버튼 (ADR-0008 결정 2·3 · #47). variant·size·fullWidth 를 무의존 class-map 으로 — cva/Radix
// 없음. 상호작용 floor(cursor·focus-visible·disabled, ADR-0008 결정 1, globals.css @layer base)는
// 이미 깔려 있으므로 여기선 시각(색·여백·모양)만 얹는다. button.ts 의 primaryButton 토큰을 흡수한다.
//
// inline-flex 중앙정렬은 후속(#48) 로딩 스피너를 위한 자리이기도 하다. variant 는 ADR-0008 결정 3
// 의 집합 — ghost(여백 없는 텍스트-링크)는 패딩 버튼이 아니라 도입을 보류(텍스트 링크는 Button 의
// 일이 아니다). 새 코드·건드리는 코드는 이 컴포넌트를 쓴다(ADR-0008 결정 4).

type Variant = "primary" | "danger" | "dangerOutline" | "outline";
type Size = "sm" | "md" | "lg";

const BASE = "inline-flex items-center justify-center rounded-lg transition disabled:opacity-50";

const VARIANT: Record<Variant, string> = {
  primary: "bg-[var(--accent)] text-[var(--accent-fg)] font-medium hover:opacity-90",
  danger: "bg-[var(--bad)] text-white font-medium hover:opacity-90",
  dangerOutline:
    "border border-[var(--bad)] text-[var(--bad)] font-medium hover:bg-[color-mix(in_srgb,var(--bad)_12%,transparent)]",
  outline: "border border-[var(--border)] text-[var(--muted)] hover:text-[var(--fg)]",
};

const SIZE: Record<Size, string> = {
  sm: "px-3 py-1 text-xs",
  md: "px-3 py-2 text-sm",
  lg: "px-4 py-2 text-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  type = "button",
  className = "",
  ...props
}: {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const cls = `${BASE} ${SIZE[size]} ${VARIANT[variant]}${fullWidth ? " w-full" : ""}${
    className ? " " + className : ""
  }`;
  // type 은 prop(기본 "button" — 폼 오발사 방지). 폼 제출 버튼은 type="submit" 를 명시한다.
  return <button type={type} className={cls} {...props} />;
}
