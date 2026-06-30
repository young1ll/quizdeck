"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ExamContext } from "@/lib/exam-context";
import { StoreContext, useStoreState } from "@/lib/store";
import { NavContext } from "@/lib/nav-context";
import { LangContext } from "@/lib/lang-context";
import { AnnotationContext, useAnnotationState } from "@/lib/annotation-context";
import {
  projectConcept,
  projectQuestion,
  type LocalizedExamData,
} from "@/lib/content-localize";
import { topicsOf } from "@/lib/session";
import { useSession } from "@/lib/auth-client";
import { isLearner, learnerId } from "@/lib/learner";
import { localStorageProgressStore } from "@/lib/progress-store";
import { compositeProgressStore } from "@/lib/progress-store-composite";
import { remoteApiProgressStore } from "@/lib/progress-store-remote";
import SyncIndicator from "./SyncIndicator";
import LangToggle from "./LangToggle";
import LoginModal from "./LoginModal";

const LANG_PREF_KEY = "quizdeck:lang"; // 기기-국소 선호 표시 언어(학습 진도 아님 → localStorage)

// exam 섹션 shell (ADR-0010 슬라이스 B). exam layout 이 콘텐츠를 1회 로드해 이 클라이언트 provider 에
// 넘긴다 — lang·content·store·annotation 컨텍스트 + 연습 게이트(LoginModal) + cross-route NavContext.
// layout 이라 라우트(hub·참조 뷰)를 가로질러 **상태가 유지**된다(퀴즈 active·게이트·studyIntent).
// 퀴즈 플로(컨트롤러·뷰 전환)는 index 페이지가 들고 있다 — 여기선 공유 상태만.
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
    const questions = data.questions.map((q) => projectQuestion(q, lang));
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

  // 연습 게이트 — verified Learner 면 즉시 실행, 익명이면 로그인 모달 띄우고 보류(전환 유도, ADR-0004).
  const learner = isLearner(session);
  const [gateOpen, setGateOpen] = useState(false);
  const pending = useRef<(() => void) | null>(null);
  const requireLearner = useCallback(
    (action: () => void) => {
      if (learner) {
        action();
        return;
      }
      pending.current = action;
      setGateOpen(true);
    },
    [learner],
  );
  // 로그인 성공 → 보류한 연습 액션 재개(모달 닫기). 신규 가입은 세션이 없어 보류 유지.
  useEffect(() => {
    if (learner && gateOpen) {
      const a = pending.current;
      pending.current = null;
      setGateOpen(false);
      a?.();
    }
  }, [learner, gateOpen]);
  const closeGate = useCallback(() => {
    pending.current = null;
    setGateOpen(false);
  }, []);

  // cross-route nav — studyOne 은 게이트 후 index 로(studyIntent 전달), openConceptFor 는 개념 라우트로.
  const router = useRouter();
  const base = `/${data.meta.provider}/${data.meta.slug}`;
  const [studyIntent, setStudyIntent] = useState<number | null>(null);
  const nav = useMemo(
    () => ({
      requireLearner,
      studyOne: (qn: number) =>
        requireLearner(() => {
          setStudyIntent(qn);
          router.push(base);
        }),
      openConceptFor: (svc: string) =>
        router.push(`${base}/concepts?seed=${encodeURIComponent(svc)}`),
      studyIntent,
      clearStudyIntent: () => setStudyIntent(null),
    }),
    [requireLearner, router, base, studyIntent],
  );

  return (
    <LangContext.Provider value={langValue}>
      <ExamContext.Provider value={examValue}>
        <StoreContext.Provider value={storeCtx}>
          <AnnotationContext.Provider value={annoCtx}>
            <NavContext.Provider value={nav}>
              <LangToggle />
              <SyncIndicator />
              {storeCtx.loaded ? (
                children
              ) : (
                <div className="py-20 text-center text-sm text-[var(--muted)]">불러오는 중…</div>
              )}
              {gateOpen && <LoginModal onClose={closeGate} />}
            </NavContext.Provider>
          </AnnotationContext.Provider>
        </StoreContext.Provider>
      </ExamContext.Provider>
    </LangContext.Provider>
  );
}
