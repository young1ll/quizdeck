import type { ButtonHTMLAttributes } from "react";

// 공통 버튼 (ADR-0008 결정 2·3 · #47/#48/#50). variant·size·fullWidth·loading 을 무의존 class-map 으로 —
// cva/Radix 없음. 상호작용 floor(cursor·focus-visible·disabled, ADR-0008 결정 1, globals.css @layer
// base)는 이미 깔려 있으므로 여기선 시각(색·여백·모양·로딩)만 얹는다. button.ts 의 primaryButton 흡수.
// 모양은 rounded-control 토큰(ADR-0008 결정 5d · #50 — = rounded-lg 8px)으로 표면 radius 를 수렴한다.
//
// inline-flex 중앙정렬은 loading 스피너와 라벨을 나란히 가운데 둔다. variant 는 ADR-0008 결정 3
// 의 집합 — ghost(여백 없는 텍스트-링크)는 패딩 버튼이 아니라 도입을 보류(텍스트 링크는 Button 의
// 일이 아니다). 새 코드·건드리는 코드는 이 컴포넌트를 쓴다(ADR-0008 결정 4).

type Variant = "primary" | "danger" | "dangerOutline" | "outline";
type Size = "sm" | "md" | "lg";

const BASE = "inline-flex items-center justify-center rounded-control transition disabled:opacity-50";

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
  loading = false,
  type = "button",
  className = "",
  disabled,
  children,
  ...props
}: {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  loading?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const cls = `${BASE} ${SIZE[size]} ${VARIANT[variant]}${fullWidth ? " w-full" : ""}${
    loading ? " gap-2" : ""
  }${className ? " " + className : ""}`;
  // type 은 prop(기본 "button" — 폼 오발사 방지). 폼 제출 버튼은 type="submit" 를 명시한다.
  // loading(#48): 스피너 표시 + 클릭 차단(disabled) + aria-busy. 라벨 '…중' 스왑을 대체한다.
  // 스피너는 border-current 라 글자색을 따라가고, prefers-reduced-motion 은 globals.css 가 처리.
  return (
    <button
      type={type}
      className={cls}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && (
        <span
          aria-hidden
          className="inline-block size-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
}
