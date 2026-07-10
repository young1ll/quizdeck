import Stats from "@/components/views/Stats";
import BackToHub from "@/components/BackToHub";

// per-exam 심화 현황 라우트 (ADR-0012 결정 4·7 · hub-and-spoke 스포크). 허브의 "현황 자세히 ›"가
// 여기로. 컨텍스트는 exam layout(ExamProviders)이 제공 — store-backed(익명 로컬 / Learner 동기화).
export default function StatsPage() {
  return (
    <>
      <BackToHub />
      <Stats />
    </>
  );
}
