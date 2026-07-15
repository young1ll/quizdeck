import { Container } from "@/components/ui/Container";

// (learner) 공통 라우트 전환 골격 — 클릭 순간 즉시 렌더돼 "반응 없음" 구간을 없앤다(설계 2026-07-15).
// 헤더는 shell(layout)이 유지하므로 본문 자리만. home(카드 그리드)·/me·provider 를 무난히 덮는
// 제목 줄 + 2열 카드 골격. exam 은 더 구체적인 [exam]/loading.tsx 가 덮는다.
export default function Loading() {
  return (
    <Container size="lg" className="py-8">
      <div aria-busy="true" aria-label="불러오는 중">
        <div className="skeleton h-4 w-40" />
        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="skeleton h-24" />
          <div className="skeleton h-24" />
          <div className="skeleton h-24" />
          <div className="skeleton h-24" />
        </div>
      </div>
    </Container>
  );
}
