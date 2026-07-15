// provider 계열 라우트 전환 골격 — 허브(/aws/)와 학습 자료 스포크(map·concepts·diagrams)의
// 콜드 첫 히트(온디맨드 ISR 생성) 동안 즉시 렌더된다(설계 2026-07-15). 페이지들의 max-w-3xl
// 래퍼와 같은 폭 — 골격→콘텐츠 교체 시 화면 점프 없음.
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <div aria-busy="true" aria-label="불러오는 중">
        <div className="skeleton h-4 w-24" />
        <div className="mt-4 skeleton h-7 w-48" />
        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="skeleton h-20" />
          <div className="skeleton h-20" />
          <div className="skeleton h-20" />
        </div>
        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="skeleton h-24" />
          <div className="skeleton h-24" />
        </div>
      </div>
    </div>
  );
}
