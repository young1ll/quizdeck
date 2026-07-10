import MyProblems from "@/components/views/MyProblems";
import BackToHub from "@/components/BackToHub";

// 내 문제함 참조 라우트 (ADR-0011, hub-and-spoke). 컨텍스트는 exam layout(ExamProviders)이 제공한다 —
// 히스토리 라우트와 같은 결(정적 shell + 클라이언트 뷰), searchParams 미사용이라 dynamic 선언 불필요.
export default function MyProblemsPage() {
  return (
    <>
      <BackToHub />
      <MyProblems />
    </>
  );
}
