"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ExamContext, useExam } from "@/lib/exam-context";
import { StoreContext, useStoreState } from "@/lib/store";
import { NavContext } from "@/lib/nav-context";
import { QuizFlowContext } from "@/lib/quiz-flow-context";
import { useExamFlow } from "@/lib/use-exam-flow";
import { usePracticeGate } from "@/lib/use-practice-gate";
import { LangContext } from "@/lib/lang-context";
import { AnnotationContext, useAnnotationState } from "@/lib/annotation-context";
import {
  projectConcept,
  projectQuestion,
  type LocalizedExamData,
} from "@/lib/content-localize";
import { topicsOf } from "@/lib/session";
import { useSession } from "@/lib/auth-client";
import { learnerId } from "@/lib/learner";
import { localStorageProgressStore } from "@/lib/progress-store";
import { compositeProgressStore } from "@/lib/progress-store-composite";
import { remoteApiProgressStore } from "@/lib/progress-store-remote";
import SyncIndicator from "./SyncIndicator";
import LangToggle from "./LangToggle";
import LoginModal from "./LoginModal";
import ExamHeaderBinder from "./ExamHeaderBinder";

const LANG_PREF_KEY = "quizdeck:lang"; // 기기-국소 선호 표시 언어(학습 진도 아님 → localStorage)

// exam 섹션 shell (ADR-0010 슬라이스 B·B2). exam layout 이 콘텐츠를 1회 로드해 이 클라이언트 provider 에
// 넘긴다 — lang·content·store·annotation 컨텍스트 + 연습 게이트(LoginModal) + cross-route NavContext +
// 퀴즈 플로(QuizFlowContext). layout 이라 라우트(hub·참조 뷰·/quiz)를 가로질러 **상태가 유지**된다.
// B2: 퀴즈 컨트롤러·phase 를 여기로 올려 hub·/quiz·studyOne 이 한 컨트롤러를 공유한다(/quiz 라우트).
export default function ExamProviders({
  data,
  children,
}: {
  data: LocalizedExamData;
  children: React.ReactNode;
}) {
  // 표시 언어 — 기본은 meta.language(가용 시) 또는 첫 가용 언어. SSR-결정적.
  const serverDefault = data.availableLangs.includes(data.meta.language)
    ? data.meta.language
    : data.availableLangs[0];
  const [lang, setLangState] = useState(serverDefault);
  useEffect(() => {
    try {
      const s = localStorage.getItem(LANG_PREF_KEY);
      if (s && data.availableLangs.includes(s)) setLangState(s);
    } catch {
      /* ignore */
    }
  }, [data.availableLangs]);
  const setLang = useCallback((l: string) => {
    setLangState(l);
    try {
      localStorage.setItem(LANG_PREF_KEY, l);
    } catch {
      /* ignore */
    }
  }, []);

  // 현재 언어로 투영(qn·정답은 언어 무관 → Progress 는 토글 무영향).
  const examValue = useMemo(() => {
    // canonical = meta.language 슬롯 → 안정 topicId(언어 토글 불변). 표시 topic 은 현재 lang.
    const questions = data.questions.map((q) => projectQuestion(q, lang, data.meta.language));
    const concepts = data.concepts.map((c) => projectConcept(c, lang));
    return {
      meta: data.meta,
      questions,
      concepts,
      diagrams: data.diagrams,
      q2svc: data.q2svc,
      icons: data.icons,
      byQn: new Map(questions.map((q) => [q.qn, q] as const)),
      topics: topicsOf(questions),
    };
  }, [data, lang]);
  const langValue = useMemo(
    () => ({ lang, setLang, available: data.availableLangs }),
    [lang, setLang, data.availableLangs],
  );

  // store(Progress) + annotation — 로그인 Learner 면 동기화 composite, 익명이면 localStorage 단독.
  const examKey = `${data.meta.provider}/${data.meta.slug}`;
  const { data: session } = useSession();
  const id = learnerId(session);
  const store = useMemo(
    () =>
      id
        ? compositeProgressStore(localStorageProgressStore(), remoteApiProgressStore())
        : undefined,
    [id],
  );
  const storeCtx = useStoreState(examKey, store);
  const annoCtx = useAnnotationState(examKey, id);

  // 연습 게이트 (ADR-0004) — verified Learner 면 즉시 실행, 익명이면 로그인 모달 띄우고 보류(전환 유도).
  // 로직(pending·resume-after-login)은 usePracticeGate 심에 있고 여기선 모달만 렌더한다.
  const { requireLearner, gateOpen, closeGate } = usePracticeGate(session);

  // 퀴즈 플로·nav 는 StoreContext **안쪽**의 ExamQuizFlow 가 제공한다 — useQuizController 가 useStore 를
  // 쓰는데, 그 Provider 를 이 컴포넌트가 렌더하므로 같은 본문에서 호출하면 컨텍스트가 아직 없다(슬라이스 B2).
  return (
    <LangContext.Provider value={langValue}>
      <ExamContext.Provider value={examValue}>
        <StoreContext.Provider value={storeCtx}>
          <AnnotationContext.Provider value={annoCtx}>
            <ExamQuizFlow requireLearner={requireLearner}>
              <ExamHeaderBinder />
              <LangToggle />
              <SyncIndicator />
              {storeCtx.loaded ? (
                children
              ) : (
                <div className="py-20 text-center text-sm text-[var(--muted)]">불러오는 중…</div>
              )}
            </ExamQuizFlow>
            {gateOpen && <LoginModal onClose={closeGate} />}
          </AnnotationContext.Provider>
        </StoreContext.Provider>
      </ExamContext.Provider>
    </LangContext.Provider>
  );
}

// 퀴즈 플로 + cross-route nav (ADR-0010 슬라이스 B2). StoreContext·ExamContext **안쪽**이라
// useExamFlow(→ useQuizController → useStore)·useExam 이 동작한다 — 컨트롤러·phase 를 라우트를 가로질러
// 유지하고 허브·/quiz·studyOne 이 한 컨트롤러를 공유한다. 오케스트레이션(phase·컨트롤러·라우팅)은
// useExamFlow 심에 있고 여기선 useExam 읽기 + router.push 주입 + provider 중첩만 한다. 게이트는 상위에서 받는다.
function ExamQuizFlow({
  requireLearner,
  children,
}: {
  requireLearner: (action: () => void) => void;
  children: React.ReactNode;
}) {
  const { questions, byQn, meta } = useExam();
  const router = useRouter();
  const navigate = useCallback((path: string) => router.push(path), [router]);
  const { quizFlow, nav } = useExamFlow({ questions, byQn, meta, requireLearner, navigate });

  return (
    <NavContext.Provider value={nav}>
      <QuizFlowContext.Provider value={quizFlow}>{children}</QuizFlowContext.Provider>
    </NavContext.Provider>
  );
}
