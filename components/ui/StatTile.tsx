// 통계 타일 (ADR-0007 결정 1 · fast-follow #43). 큰 숫자 b + 작은 라벨 s — Home(연습 통계)·
// Dashboard(학습 현황)가 공유한다. 패딩만 달라 className 으로 빼 시각을 보존한다 — Home 은 기본
// p-2, Dashboard 는 py-2 를 넘긴다.

export function StatTile({
  b,
  s,
  className = "p-2",
}: {
  b: React.ReactNode;
  s: string;
  className?: string;
}) {
  return (
    <div className={`rounded-control bg-[var(--panel-2)] ${className}`.trim()}>
      <div className="text-base font-bold">{b}</div>
      <div className="text-[10px] text-[var(--muted)]">{s}</div>
    </div>
  );
}
