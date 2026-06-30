"use client";

import { useCallback, useEffect, useState } from "react";
import { useExam } from "@/lib/exam-context";
import { type Mode } from "@/lib/store";
import { useNav } from "@/lib/nav-context";
import { useSession } from "@/lib/auth-client";
import { isLearner } from "@/lib/learner";
import { useQuizController } from "@/lib/use-quiz";
import Home from "@/components/views/Home";
import Setup from "@/components/views/Setup";
import Quiz from "@/components/views/Quiz";
import Result from "@/components/views/Result";

// exam 허브 + 퀴즈 플로 (ADR-0010 슬라이스 B). 콘텐츠·store·게이트·nav 는 layout(ExamProviders)이
// 제공한다. 여기는 hub(home — 모드·이어하기 + 참조 라우트 링크) ↔ setup ↔ quiz ↔ result 의 집중
// 상태 플로다(퀴즈 컨트롤러는 슬라이스 B 에서 안 건드림 — phase state 로만 전환). 참조 뷰는 라우트.
type Phase = "home" | "setup" | "quiz" | "result";

export default function ExamIndex() {
  const { byQn, questions } = useExam();
  const { data: session } = useSession();
  const learner = isLearner(session);
  const nav = useNav();
  const [phase, setPhase] = useState<Phase>("home");
  const [setupMode, setSetupMode] = useState<Mode>("study");

  const quiz = useQuizController(
    questions,
    byQn,
    useCallback(() => setPhase("result"), []),
    useCallback(() => setPhase("home"), []),
    useCallback(() => setPhase("quiz"), []),
  );

  // 다른 라우트(검색·서비스맵)에서 온 단일 문항 학습 의도 소비 → 퀴즈 시작. layout 의 nav 가 보존한다.
  useEffect(() => {
    if (nav.studyIntent == null) return;
    const qn = nav.studyIntent;
    nav.clearStudyIntent();
    quiz.studyOne(qn);
    // studyIntent 변화 시에만 — nav/quiz 는 effect 실행 시점의 최신을 쓴다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav.studyIntent]);

  return (
    <>
      {phase === "home" && (
        <Home
          isLearner={learner}
          onStartMode={(m) =>
            nav.requireLearner(() => {
              setSetupMode(m);
              setPhase("setup");
            })
          }
          onResume={quiz.resume}
          onDiscard={quiz.discard}
        />
      )}
      {phase === "setup" && (
        <Setup
          mode={setupMode}
          onCancel={() => setPhase("home")}
          onStart={(opts) => {
            const ok = quiz.start(setupMode, opts);
            if (!ok) alert("해당 조건의 문항이 없습니다.");
          }}
        />
      )}
      {phase === "quiz" && <Quiz quiz={quiz} />}
      {phase === "result" && <Result quiz={quiz} onHome={() => setPhase("home")} />}
    </>
  );
}
