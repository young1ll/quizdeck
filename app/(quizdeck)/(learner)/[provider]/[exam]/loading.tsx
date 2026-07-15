// exam 섹션 라우트 전환 골격 — layout 의 Container(md) 안에서 렌더되므로 골격만(설계 2026-07-15).
// 허브(제목·현황 줄·타일 그리드)를 닮은 자리 배치 — 스포크(개념·맵 등)에서도 무난하다.
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="불러오는 중" className="space-y-6">
      <div>
        <div className="skeleton h-3 w-24" />
        <div className="mt-3 skeleton h-7 w-64" />
      </div>
      <div className="skeleton h-12" />
      <div className="grid grid-cols-3 gap-3">
        <div className="skeleton h-20" />
        <div className="skeleton h-20" />
        <div className="skeleton h-20" />
      </div>
    </div>
  );
}
