import { FieldStatus } from "@astryxdesign/core/FieldStatus";

// 공통 폼 피드백 메시지 — astryx FieldStatus 래퍼 (ADR-0014 Phase 1, ADR-0007 결정 1 계승). 호출부
// 시그니처(kind bad|good + children + className)는 유지, 내부만 astryx. bad→error(role=alert),
// good→success(role=status) — 기존 role 시맨틱과 동일하고 aria-live 까지 astryx 가 얹는다. 모든 호출부가
// 문자열 children(에러 메시지·성공 문구)을 넘기므로 FieldStatus.message(string)로 전달한다. className
// (mt-2 등 폼 레이아웃 여백)은 BaseProps 로 통과.
export function Msg({
  kind,
  children,
  className = "",
}: {
  kind: "bad" | "good";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <FieldStatus
      type={kind === "bad" ? "error" : "success"}
      message={typeof children === "string" ? children : String(children)}
      className={className || undefined}
    />
  );
}
