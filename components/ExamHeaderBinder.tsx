"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { useExam } from "@/lib/exam-context";
import { useQuizFlow } from "@/lib/quiz-flow-context";
import { useSession } from "@/lib/auth-client";
import { isAdminSession } from "@/lib/admin";
import { buildHeaderModel } from "@/lib/header-model";
import { useSetHeaderSlot } from "@/lib/header-slot";

// exam 섹션의 맥락 헤더 바인더 (ADR-0012 결정 5·6·9·10). ExamProviders 안쪽(useExam·useQuizFlow 가용)에서
// 헤더 **모델**을 계산해 슬롯에 채운다 — 결정은 순수 buildHeaderModel(lib/header-model, 테스트됨), 렌더는
// shell(LearnerHeader)이 한다. 시각 출력 없음(모델만 설정) · onExit=quiz.quit(세션을 store.active 에 보존
// → 허브 이어하기 배너, 비파괴). 바깥(카탈로그·/me)의 기본 헤더는 LearnerHeader 가 슬롯 없을 때 렌더.
export default function ExamHeaderBinder() {
  const { meta } = useExam();
  const { quiz, phase } = useQuizFlow();
  const { data: session } = useSession();
  const pathname = usePathname();

  const cur = quiz.current;
  const isOnQuizRoute = !!pathname?.endsWith("/quiz");
  const isAdmin = isAdminSession(session);
  const idx = cur?.idx ?? 0;
  const total = cur?.total ?? 0;
  const hasCurrent = !!cur;
  const exam = cur?.exam ?? false;
  const timeLeft = quiz.timeLeft;
  const quit = quiz.quit;

  const model = useMemo(
    () =>
      buildHeaderModel({
        meta,
        phase,
        isOnQuizRoute,
        isAdmin,
        current: hasCurrent ? { idx, total } : null,
        exam,
        timeLeft,
      }),
    [meta, phase, isOnQuizRoute, isAdmin, hasCurrent, idx, total, exam, timeLeft],
  );

  const slot = useMemo(() => ({ model, onExit: quit }), [model, quit]);
  useSetHeaderSlot(slot);
  return null;
}
