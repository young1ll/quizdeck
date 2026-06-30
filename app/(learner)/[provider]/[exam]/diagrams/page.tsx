import Diagrams from "@/components/views/Diagrams";
import BackToHub from "@/components/BackToHub";

// 참조 라우트 (ADR-0010 슬라이스 B, hub-and-spoke). 컨텍스트는 exam layout(ExamProviders)이 제공.
export default function DiagramsPage() {
  return (
    <>
      <BackToHub />
      <Diagrams />
    </>
  );
}
