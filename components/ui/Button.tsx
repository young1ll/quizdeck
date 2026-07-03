"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Button as AstryxButton } from "@astryxdesign/core/Button";

// 공통 버튼 — astryx Button 래퍼 (ADR-0014 Phase 1, ADR-0008 결정 2 대체). 호출부 시그니처
// (variant/size/fullWidth/loading + children + HTML attrs)는 **그대로 유지**하고 내부만 astryx 로 매핑한다
// (65곳 호출부 대량 변경 회피). astryx Button 은 label(string) 필수라, string children → label, JSX
// children 은 children 으로 전달. 우리 variant(primary/danger/dangerOutline/outline) → astryx
// (primary/secondary/ghost/destructive). title → astryx tooltip(BaseProps 는 title 을 omit).
//
// dangerOutline = outline+danger(덜 요란한 파괴적 affordance — 회원 탈퇴 트리거·데이터 초기화).
// astryx 엔 outline-destructive 내장이 없어 danger(destructive)와 **같은 룩으로 붕괴**하던 버그가 있었다.
// 어댑터가 astryx 가 못 주는 룩을 **한 곳에서** 공급한다: secondary(중립 outline) 베이스 + bad 테두리/텍스트.
// (테마 확장으로 진짜 astryx variant 등록도 가능하나, 룩을 어댑터에 담아 A1 을 작고 안전하게. 회귀는
// components/ui/Button.test.tsx 가 핀 — dangerOutline≠danger.)
type Variant = "primary" | "danger" | "dangerOutline" | "outline";
type Size = "sm" | "md" | "lg";

const VARIANT_MAP: Record<Variant, "primary" | "secondary" | "ghost" | "destructive"> = {
  primary: "primary",
  danger: "destructive",
  dangerOutline: "secondary", // 중립 outline 베이스 위에 bad 색을 얹는다(아래 EXTRA_CLASS).
  outline: "secondary",
};

// astryx 가 못 주는 룩을 어댑터가 보태는 곳 — dangerOutline 만 bad 테두리/텍스트를 얹어 danger 와 구별.
const EXTRA_CLASS: Partial<Record<Variant, string>> = {
  dangerOutline: "border-[var(--bad)] text-[var(--bad)]",
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
      className={
        `${fullWidth ? "w-full " : ""}${EXTRA_CLASS[variant] ? `${EXTRA_CLASS[variant]} ` : ""}${className}`.trim() ||
        undefined
      }
      tooltip={typeof title === "string" ? title : undefined}
      // 나머지 HTML attrs(onClick·name·value·form·aria-*·data-*·id·style)는 astryx BaseProps 로 흘린다.
      // 스프레드 타입 정합은 astryx 가 관대(Omit<HTMLAttributes>)하나 excess-prop 회피 위해 캐스트.
      {...(rest as Record<string, unknown>)}
    >
      {extraChildren}
    </AstryxButton>
  );
}
