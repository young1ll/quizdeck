"use client";

import { useCallback, useMemo, useState } from "react";
import type { ExamData } from "@/lib/types";
import { ExamContext, useExam } from "@/lib/exam-context";
import { StoreContext, useStore, useStoreState, type Mode } from "@/lib/store";
import { NavContext, type View } from "@/lib/nav-context";
import { topicsOf } from "@/lib/session";
import { useQuizController } from "@/lib/use-quiz";
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
  const ctx = useStoreState(examKey);
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
  const [view, setView] = useState<View>("home");
  const [setupMode, setSetupMode] = useState<Mode>("study");
  const [conceptSeed, setConceptSeed] = useState("");

  const go = useCallback((v: View) => setView(v), []);

  const quiz = useQuizController(
    questions,
    byQn,
    useCallback(() => setView("result"), []),
    useCallback(() => setView("home"), []),
    useCallback(() => setView("quiz"), []),
  );

  const nav = useMemo(
    () => ({
      view,
      go,
      studyOne: (qn: number) => quiz.studyOne(qn),
      openConceptFor: (svc: string) => {
        setConceptSeed(svc);
        setView("concept");
      },
      conceptSeed,
      clearConceptSeed: () => setConceptSeed(""),
    }),
    [view, go, quiz, conceptSeed],
  );

  if (!loaded) {
    return <div className="py-20 text-center text-sm text-[var(--muted)]">불러오는 중…</div>;
  }

  const showBackBar = view !== "home" && view !== "quiz" && view !== "result";

  return (
    <NavContext.Provider value={nav}>
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
          onStartMode={(m) => {
            setSetupMode(m);
            setView("setup");
          }}
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
    </NavContext.Provider>
  );
}
