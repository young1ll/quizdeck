"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Button as AstryxButton, type ButtonVariant } from "@astryxdesign/core/Button";

// 공통 버튼 — astryx Button 래퍼 (ADR-0014 Phase 1, ADR-0008 결정 2 대체). 호출부 시그니처
// (variant/size/fullWidth/loading + children + HTML attrs)는 **그대로 유지**하고 내부만 astryx 로 매핑한다
// (65곳 호출부 대량 변경 회피). astryx Button 은 label(string) 필수라, string children → label, JSX
// children 은 children 으로 전달. 우리 variant(primary/danger/dangerOutline/outline) → astryx
// (primary/secondary/ghost/destructive). title → astryx tooltip(BaseProps 는 title 을 omit).
//
// dangerOutline = outline+danger(덜 요란한 파괴적 affordance — 회원 탈퇴 트리거·데이터 초기화).
// astryx 엔 outline-destructive 내장이 없어 danger(destructive)와 **같은 룩으로 붕괴**하던 버그가 있었다.
// 진짜 astryx 커스텀 variant 로 등록(A1 Path-B): 타입은 types/astryx.d.ts 의 ButtonVariantMap
// augmentation, 룩은 lib/astryx-theme.ts 의 components.button 이 준다 — 룩이 astryx 언어로 흐른다
// (Tailwind-on-astryx override 없음). 회귀는 Button.test 가 data-variant 로 핀 — dangerOutline≠danger.
type Variant = "primary" | "danger" | "dangerOutline" | "outline";
type Size = "sm" | "md" | "lg";

const VARIANT_MAP: Record<Variant, ButtonVariant> = {
  primary: "primary",
  danger: "destructive",
  dangerOutline: "dangerOutline", // 커스텀 astryx variant(테마가 룩 공급). 더는 destructive 로 붕괴 안 함.
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
  icon,
  ...rest
}: {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  loading?: boolean;
  // 라벨 앞 선행 아이콘(astryx Button icon) — 아이콘+라벨을 한 그룹으로 배치(소셜/패스키 등).
  icon?: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const label = typeof children === "string" ? children : "";
  const extraChildren = typeof children === "string" ? undefined : children;
  return (
    <AstryxButton
      label={label}
      variant={VARIANT_MAP[variant]}
      size={size}
      type={type}
      icon={icon}
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
