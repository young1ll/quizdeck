"use client";

import { useEffect, useRef } from "react";
import { useQuizFlow } from "@/lib/quiz-flow-context";
import Setup from "@/components/views/Setup";
import Quiz from "@/components/views/Quiz";
import Result from "@/components/views/Result";

// 퀴즈 플로 뷰 (ADR-0010 슬라이스 B2 — 구 quiz/page.tsx 본문). 컨트롤러·phase 는 layout(ExamProviders)이
// 들고 유지하고, 여기는 phase 로 setup ↔ active ↔ result 를 렌더할 뿐. 진입은 허브의 모드/이어하기,
// 검색의 studyOne, 그리고 **컬렉션 딥엔트리 initialSet**(/quiz?set=…, ADR-0022 S1.5 — 게이트 후 해당
// qn 목록 일회성 학습을 곧장 시작. 유효 문항이 없으면 setup 에 머문다). 직접 진입(새로고침)은 setup.
export default function QuizFlow({ initialSet = [] }: { initialSet?: number[] }) {
  const { quiz, phase, setupMode, startSet, goHub } = useQuizFlow();

  // 딥엔트리는 마운트 1회만 — 이후 same-route 상태 전이(결과→재시작 등)에 재발화하지 않는다.
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current || initialSet.length === 0) return;
    fired.current = true;
    startSet(initialSet);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
