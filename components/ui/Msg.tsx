// 공통 폼 피드백 메시지 (ADR-0007 결정 1). text-xs 의 bad(에러)·good(성공) 한 줄 — bad 는
// role=alert, good 은 role=status. className 으로 여백(폼 레이아웃에 따른 mt-2 등)을 더한다.

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
    <p
      className={`text-xs ${kind === "bad" ? "text-[var(--bad)]" : "text-[var(--good)]"} ${className}`.trim()}
      role={kind === "bad" ? "alert" : "status"}
    >
      {children}
    </p>
  );
}
