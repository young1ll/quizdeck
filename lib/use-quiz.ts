"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Question } from "./types";
import {
  basePool,
  computeResult,
  currentView,
  setsEqual,
  shuffle,
  smartOrder,
  type CurrentView,
  type QuizResult,
} from "./session";
import { sessionReducer, stampElapsed, type SessionAction } from "./session-reducer";
import type { Mode, SessionState } from "./store";
import { useStore } from "./store";

// 결과 뷰모델 — 세션 결과 집계(computeResult, 순수)에 mode·exam·소요시간을 얹은 것. 컨트롤러가 finish 시
// 1회 계산해 노출하고, Result 뷰·PDF 는 재채점 대신 이걸 읽는다(옛날엔 okCount·wrong·주제별을 뷰마다 재계산).
export interface ResultView extends QuizResult {
  mode: Mode;
  exam: boolean;
  sec: number; // 소요 초(finish 시점 고정 — 결과 화면에서 안 늘어남)
}

export interface StartOpts {
  topic: string;
  shuffle: boolean;
  count: number;
  order: "num" | "rand";
  examMin: number;
}

export interface QuizController {
  current: CurrentView | null; // 현재 문항 파생 읽기(Quiz 화면이 raw session 대신 읽음)
  result: ResultView | null; // finish 시 1회 계산된 결과(Result·PDF·retryWrong 이 읽음)
  timeLeft: number | null; // 시험 모드 남은 초
  start: (mode: Mode, opts: StartOpts) => boolean;
  studyOne: (qn: number) => void;
  resume: () => void;
  discard: () => void;
  quit: () => void;
  select: (k: string, multi: boolean) => void;
  submit: () => void;
  next: () => void;
  prev: () => void;
  navTo: (i: number) => void;
  finish: () => void; // 비시험: 마지막에서 결과
  finishExam: () => void; // 시험: 전체 자동채점
  retryWrong: () => void;
  toggleFlag: () => void;
}

// 퀴즈 컨트롤러 — imperative shell (아키텍처 리뷰). 상태 전이는 순수 sessionReducer 가 하고(결정적·단독
// 테스트), 이 훅은 shell 로서 불순물(store 읽기·basePool/shuffle/rng·Date.now)을 해결해 액션 데이터로
// 주입하고, 전이 결과에 부작용(영속·recordResult·pushSession·타이머·콜백)을 엮는다. 공개 인터페이스는
// 불변(QuizController) — 소비자(Quiz·Result·useExamFlow)는 이 변경을 못 느낀다.
export function useQuizController(
  questions: Question[],
  byQn: Map<number, Question>,
  onResult: () => void,
  onHome: () => void,
  goQuiz: () => void,
): QuizController {
  const { store, recordResult, setActive, pushSession } = useStore();
  const [session, setSession] = useState<SessionState | null>(null);
  const [result, setResult] = useState<ResultView | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const sessRef = useRef<SessionState | null>(null);
  sessRef.current = session;
  const resultRef = useRef<ResultView | null>(null);
  resultRef.current = result;

  // reducer 로 상태 전이 후 setSession — 순수 core 를 훅에 잇는 dispatch. next 를 반환해 호출부가 부작용
  // (영속·콜백)에 쓴다. sessRef 로 최신 상태를 읽는다. no-op 전이면 reducer 가 같은 참조를 돌려준다.
  const dispatch = useCallback((action: SessionAction): SessionState | null => {
    const next = sessionReducer(sessRef.current, action);
    setSession(next);
    return next;
  }, []);

  // 진행 중 세션 영속(store.active).
  const persist = useCallback((s: SessionState) => setActive(s), [setActive]);

  // ── 세션 시작 ──────────────────────────────────────────────
  const start = useCallback(
    (mode: Mode, opts: StartOpts): boolean => {
      let p = basePool(questions, mode, opts.topic, store);
      if (!p.length) return false;
      if (mode === "smart") p = smartOrder(p, questions, store.hist);
      else if (opts.order === "rand") p = shuffle(p);
      else p = p.slice().sort((a, b) => a.qn - b.qn);
      const n = Math.max(1, Math.min(opts.count || 20, p.length));
      p = p.slice(0, n);
      const exam = mode === "exam";
      const limit = exam ? (opts.examMin || 180) * 60 : undefined;
      const next = dispatch({
        type: "start",
        queue: p.map((d) => d.qn),
        mode,
        exam,
        limit,
        now: Date.now(),
      });
      if (next) persist(next);
      if (exam) setTimeLeft(limit ?? null);
      goQuiz();
      return true;
    },
    [questions, store, dispatch, persist, goQuiz],
  );

  const studyOne = useCallback(
    (qn: number) => {
      dispatch({ type: "studyOne", qn, now: Date.now() });
      setActive(null); // 일회성 학습 — store.active 로 영속하지 않는다
      setTimeLeft(null);
      goQuiz();
    },
    [dispatch, setActive, goQuiz],
  );

  const resume = useCallback(() => {
    const a = store.active;
    if (!a) return;
    const next = dispatch({ type: "resume", active: a, now: Date.now() });
    if (next?.exam && next.limit) setTimeLeft(next.limit - (a.elapsed || 0));
    goQuiz();
  }, [store.active, dispatch, goQuiz]);

  const discard = useCallback(() => {
    setActive(null);
  }, [setActive]);

  const quit = useCallback(() => {
    const s = sessRef.current;
    if (s) setActive(stampElapsed(s, Date.now()));
    setTimeLeft(null);
    onHome();
  }, [setActive, onHome]);

  // ── 선택/제출 ──────────────────────────────────────────────
  const select = useCallback(
    (k: string, multi: boolean) => {
      const next = dispatch({ type: "select", key: k, multi });
      if (next?.exam) persist(next); // 시험만 즉시 영속(비시험은 메모리)
    },
    [dispatch, persist],
  );

  const submit = useCallback(() => {
    const s = sessRef.current;
    if (!s) return;
    const qn = s.queue[s.idx];
    const d = byQn.get(qn)!;
    const next = dispatch({ type: "submit", answer: d.answer });
    if (!next || next === s) return; // 미선택 no-op
    const a = next.answers[qn];
    recordResult(qn, a.sel, a.ok!);
    persist(next);
  }, [byQn, dispatch, recordResult, persist]);

  const goIdx = useCallback(
    (i: number) => {
      const before = sessRef.current;
      const next = dispatch({ type: "navTo", idx: i });
      if (next && next !== before) persist(next);
    },
    [dispatch, persist],
  );

  // ── 결과 집계 ──────────────────────────────────────────────
  // 결과를 **한 번** 계산(computeResult, 순수)해 result 모델로 노출한다 — Result 뷰·PDF·retryWrong 이
  // 재채점 대신 이걸 읽는다. 소요 시간만 시간 의존이라 여기서 얹는다(finish 시점 고정).
  const doFinish = useCallback(() => {
    const s = sessRef.current;
    if (!s) return;
    const r = computeResult(s, byQn);
    const sec = Math.round((Date.now() - s.start) / 1000);
    pushSession({
      date: new Date().toISOString(),
      mode: s.mode,
      n: r.total,
      ok: r.okCount,
      sec,
    });
    setActive(null);
    setTimeLeft(null);
    setResult({ ...r, mode: s.mode, exam: s.exam, sec });
    setSession({ ...s });
    onResult();
  }, [byQn, pushSession, setActive, onResult]);

  const finish = doFinish;

  const finishExam = useCallback(() => {
    const s = sessRef.current;
    if (!s) return;
    // 미응답 포함 전체 채점 + 이력 기록
    s.queue.forEach((qn) => {
      const d = byQn.get(qn)!;
      const sel = s.answers[qn]?.sel ?? [];
      const ok = setsEqual(sel, d.answer);
      recordResult(qn, sel, ok);
    });
    doFinish();
  }, [byQn, recordResult, doFinish]);

  const next = useCallback(() => {
    const s = sessRef.current;
    if (!s) return;
    if (s.idx < s.queue.length - 1) {
      const n = dispatch({ type: "next" });
      if (n && n !== s) persist(n);
    } else if (!s.exam) doFinish();
  }, [dispatch, persist, doFinish]);

  const prev = useCallback(() => {
    const s = sessRef.current;
    if (!s) return;
    const n = dispatch({ type: "prev" });
    if (n && n !== s) persist(n);
  }, [dispatch, persist]);

  const retryWrong = useCallback(() => {
    const w = resultRef.current?.wrong.map((x) => x.qn) ?? [];
    if (!w.length) return;
    const next = dispatch({ type: "retryWrong", queue: shuffle(w), now: Date.now() });
    if (next) persist(next);
    goQuiz();
  }, [dispatch, persist, goQuiz]);

  const toggleFlag = useCallback(() => {
    const before = sessRef.current;
    const next = dispatch({ type: "toggleFlag" });
    if (next && next !== before) persist(next);
  }, [dispatch, persist]);

  // ── 시험 타이머 ────────────────────────────────────────────
  useEffect(() => {
    if (!session?.exam || !session.limit) return;
    const id = setInterval(() => {
      const s = sessRef.current;
      if (!s || !s.limit) return;
      const el = Math.round((Date.now() - s.start) / 1000);
      const left = s.limit - el;
      setTimeLeft(left);
      if (left <= 0) {
        clearInterval(id);
        finishExam();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [session?.exam, session?.limit, finishExam]);

  const current = session ? currentView(session, byQn) : null;

  return {
    current,
    result,
    timeLeft,
    start,
    studyOne,
    resume,
    discard,
    quit,
    select,
    submit,
    next,
    prev,
    navTo: goIdx,
    finish,
    finishExam,
    retryWrong,
    toggleFlag,
  };
}
