"use client";

import { useQuizFlow } from "@/lib/quiz-flow-context";
import Setup from "@/components/views/Setup";
import Quiz from "@/components/views/Quiz";
import Result from "@/components/views/Result";

// 퀴즈 플로 라우트 (ADR-0010 슬라이스 B2). 컨트롤러·phase 는 layout(ExamProviders)이 들고 유지한다 —
// 여기는 phase 로 setup ↔ active ↔ result 를 렌더할 뿐. 진입은 허브의 모드/이어하기 또는 검색의 studyOne
// (모두 layout 에서 phase·세션을 세팅하고 /quiz 로 push). 직접 진입(딥링크·새로고침)은 setup(기본)으로.
export default function QuizFlowPage() {
  const { quiz, phase, setupMode, goHub } = useQuizFlow();

  if (phase === "setup") {
    return (
      <Setup
        mode={setupMode}
        onCancel={goHub}
        onStart={(opts) => {
          const ok = quiz.start(setupMode, opts);
          if (!ok) alert("해당 조건의 문항이 없습니다.");
        }}
      />
    );
  }
  if (phase === "result") return <Result quiz={quiz} onHome={goHub} />;
  return <Quiz quiz={quiz} />;
}
