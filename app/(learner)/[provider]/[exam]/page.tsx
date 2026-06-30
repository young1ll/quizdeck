"use client";

import { useSession } from "@/lib/auth-client";
import { isLearner } from "@/lib/learner";
import { useQuizFlow } from "@/lib/quiz-flow-context";
import Home from "@/components/views/Home";

// exam 허브 (ADR-0010 슬라이스 B·B2). 콘텐츠·store·게이트·퀴즈 플로는 layout(ExamProviders)이 제공한다.
// 여기는 hub-and-spoke 의 허브 — 모드 시작/이어하기/버리기 + 참조 라우트 링크(Home 내부)뿐. 퀴즈 플로
// (setup·active·result)는 /quiz 라우트가 phase 로 렌더한다(컨트롤러는 layout 공유). 참조 뷰도 라우트.
export default function ExamHub() {
  const { data: session } = useSession();
  const learner = isLearner(session);
  const { startMode, resume, discard } = useQuizFlow();
  return (
    <Home isLearner={learner} onStartMode={startMode} onResume={resume} onDiscard={discard} />
  );
}
