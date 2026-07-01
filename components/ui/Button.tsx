"use client";

import type { ButtonHTMLAttributes } from "react";
import { Button as AstryxButton } from "@astryxdesign/core/Button";

// 공통 버튼 — astryx Button 래퍼 (ADR-0014 Phase 1, ADR-0008 결정 2 대체). 호출부 시그니처
// (variant/size/fullWidth/loading + children + HTML attrs)는 **그대로 유지**하고 내부만 astryx 로 매핑한다
// (65곳 호출부 대량 변경 회피). astryx Button 은 label(string) 필수라, string children → label, JSX
// children 은 children 으로 전달. 우리 variant(primary/danger/dangerOutline/outline) → astryx
// (primary/secondary/ghost/destructive). title → astryx tooltip(BaseProps 는 title 을 omit).
type Variant = "primary" | "danger" | "dangerOutline" | "outline";
type Size = "sm" | "md" | "lg";

const VARIANT_MAP: Record<Variant, "primary" | "secondary" | "ghost" | "destructive"> = {
  primary: "primary",
  danger: "destructive",
  dangerOutline: "destructive",
  outline: "secondary",
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
  title,
  ...rest
}: {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  loading?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const label = typeof children === "string" ? children : "";
  const extraChildren = typeof children === "string" ? undefined : children;
  return (
    <AstryxButton
      label={label}
      variant={VARIANT_MAP[variant]}
      size={size}
      type={type}
      isDisabled={disabled || undefined}
      isLoading={loading}
      className={`${fullWidth ? "w-full " : ""}${className}`.trim() || undefined}
      tooltip={typeof title === "string" ? title : undefined}
      // 나머지 HTML attrs(onClick·name·value·form·aria-*·data-*·id·style)는 astryx BaseProps 로 흘린다.
      // 스프레드 타입 정합은 astryx 가 관대(Omit<HTMLAttributes>)하나 excess-prop 회피 위해 캐스트.
      {...(rest as Record<string, unknown>)}
    >
      {extraChildren}
    </AstryxButton>
  );
}
