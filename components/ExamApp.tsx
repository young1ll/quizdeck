"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ExamData } from "@/lib/types";
import { ExamContext, useExam } from "@/lib/exam-context";
import { StoreContext, useStore, useStoreState, type Mode } from "@/lib/store";
import { NavContext, type View } from "@/lib/nav-context";
import { topicsOf } from "@/lib/session";
import { useQuizController } from "@/lib/use-quiz";
import { useSession } from "@/lib/auth-client";
import { localStorageProgressStore } from "@/lib/progress-store";
import { compositeProgressStore } from "@/lib/progress-store-composite";
import { remoteApiProgressStore } from "@/lib/progress-store-remote";
import SyncIndicator from "./SyncIndicator";
import LoginModal from "./LoginModal";
import Home from "./views/Home";
import Setup from "./views/Setup";
import Quiz from "./views/Quiz";
import Result from "./views/Result";
import Concepts from "./views/Concepts";
import Diagrams from "./views/Diagrams";
import ServiceMap from "./views/ServiceMap";
import Search from "./views/Search";
import History from "./views/History";

export default function ExamApp({ data }: { data: ExamData }) {
  const examValue = useMemo(
    () => ({
      ...data,
      byQn: new Map(data.questions.map((q) => [q.qn, q] as const)),
      topics: topicsOf(data.questions),
    }),
    [data],
  );

  return (
    <ExamContext.Provider value={examValue}>
      <StoreProvider examKey={`${data.meta.provider}/${data.meta.slug}`}>
        <ExamInner />
      </StoreProvider>
    </ExamContext.Provider>
  );
}

function StoreProvider({
  examKey,
  children,
}: {
  examKey: string;
  children: React.ReactNode;
}) {
  const { data: session } = useSession();
  const learnerId = session?.user?.id ?? null;
  // 로그인 Learner → local-first composite(localStorage + /api/progress 동기화).
  // 익명(또는 세션 해석 전) → localStorage 단독(useStoreState 기본). (ADR-0001 seam 무변경 drop-in)
  // 첫 로그인 시 local↔server 는 평범한 LWW 로 reconcile 된다 — 전용 anonymous→login 병합은 V3.
  const store = useMemo(
    () =>
      learnerId
        ? compositeProgressStore(localStorageProgressStore(), remoteApiProgressStore())
        : undefined,
    [learnerId],
  );
  const ctx = useStoreState(examKey, store);
  return <StoreContext.Provider value={ctx}>{children}</StoreContext.Provider>;
}

const VIEW_TITLE: Partial<Record<View, string>> = {
  concept: "개념",
  diagram: "다이어그램",
  map: "서비스 맵",
  search: "검색",
  history: "히스토리",
};

function ExamInner() {
  const { byQn, questions } = useExam();
  const { loaded } = useStore();
  const { data: session } = useSession();
  // Learner = 이메일 검증된 신원(미인증은 세션이 없음). 연습은 Learner 전용. (ADR-0004)
  const isLearner = !!session?.user?.emailVerified;
  const [view, setView] = useState<View>("home");
  const [setupMode, setSetupMode] = useState<Mode>("study");
  const [conceptSeed, setConceptSeed] = useState("");
  const [gateOpen, setGateOpen] = useState(false);
  const pendingPractice = useRef<(() => void) | null>(null);

  const go = useCallback((v: View) => setView(v), []);

  const quiz = useQuizController(
    questions,
    byQn,
    useCallback(() => setView("result"), []),
    useCallback(() => setView("home"), []),
    useCallback(() => setView("quiz"), []),
  );

  // 연습 게이트 — verified Learner 면 즉시 실행, 익명이면 로그인 모달을 띄우고 보류한다.
  // 콘텐츠는 공개라 이 게이트는 클라이언트 UX(전환 유도)다. (ADR-0004 결정 1·2)
  const requireLearner = useCallback(
    (action: () => void) => {
      if (isLearner) {
        action();
        return;
      }
      pendingPractice.current = action;
      setGateOpen(true);
    },
    [isLearner],
  );

  // 모달에서 (기존) verified 로그인 성공 → 막혔던 연습을 이어 진입하고 모달을 닫는다.
  // 신규 가입은 세션이 안 생기므로(메일 인증 대기) 보류분이 그대로 남고 사용자가 모달을 닫는다.
  useEffect(() => {
    if (isLearner && gateOpen) {
      const action = pendingPractice.current;
      pendingPractice.current = null;
      setGateOpen(false);
      action?.();
    }
  }, [isLearner, gateOpen]);

  const closeGate = useCallback(() => {
    pendingPractice.current = null;
    setGateOpen(false);
  }, []);

  const nav = useMemo(
    () => ({
      view,
      go,
      studyOne: (qn: number) => requireLearner(() => quiz.studyOne(qn)),
      openConceptFor: (svc: string) => {
        setConceptSeed(svc);
        setView("concept");
      },
      conceptSeed,
      clearConceptSeed: () => setConceptSeed(""),
    }),
    [view, go, quiz, conceptSeed, requireLearner],
  );

  if (!loaded) {
    return <div className="py-20 text-center text-sm text-[var(--muted)]">불러오는 중…</div>;
  }

  const showBackBar = view !== "home" && view !== "quiz" && view !== "result";

  return (
    <NavContext.Provider value={nav}>
      <SyncIndicator />
      {showBackBar && (
        <div className="mb-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setView("home")}
            className="text-sm text-[var(--muted)] hover:text-[var(--fg)]"
          >
            ← 홈
          </button>
          <span className="text-sm font-semibold">{VIEW_TITLE[view]}</span>
        </div>
      )}

      {view === "home" && (
        <Home
          isLearner={isLearner}
          onStartMode={(m) =>
            requireLearner(() => {
              setSetupMode(m);
              setView("setup");
            })
          }
          onResume={quiz.resume}
          onDiscard={quiz.discard}
        />
      )}
      {view === "setup" && (
        <Setup
          mode={setupMode}
          onCancel={() => setView("home")}
          onStart={(opts) => {
            const ok = quiz.start(setupMode, opts);
            if (!ok) alert("해당 조건의 문항이 없습니다.");
          }}
        />
      )}
      {view === "quiz" && <Quiz quiz={quiz} />}
      {view === "result" && <Result quiz={quiz} />}
      {view === "concept" && <Concepts />}
      {view === "diagram" && <Diagrams />}
      {view === "map" && <ServiceMap />}
      {view === "search" && <Search />}
      {view === "history" && <History />}

      {gateOpen && <LoginModal onClose={closeGate} />}
    </NavContext.Provider>
  );
}
