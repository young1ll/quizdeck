"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Question } from "./types";
import {
  basePool,
  setsEqual,
  shuffle,
  smartOrder,
} from "./session";
import type { Mode, SessionState, StoreContext as _ } from "./store";
import { useStore } from "./store";

export interface StartOpts {
  topic: string;
  shuffle: boolean;
  count: number;
  order: "num" | "rand";
  examMin: number;
}

export interface QuizController {
  session: SessionState | null;
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

export function useQuizController(
  questions: Question[],
  byQn: Map<number, Question>,
  onResult: () => void,
  onHome: () => void,
  goQuiz: () => void,
): QuizController {
  const { store, recordResult, setActive, pushSession } = useStore();
  const [session, setSession] = useState<SessionState | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const sessRef = useRef<SessionState | null>(null);
  sessRef.current = session;

  // store가 늦게 로드돼도 active를 메모리 세션과 동기화하진 않음(명시적 resume만)
  const persist = useCallback(
    (s: SessionState) => {
      setSession({ ...s });
      setActive(s);
    },
    [setActive],
  );

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
      const s: SessionState = {
        queue: p.map((d) => d.qn),
        idx: 0,
        mode,
        exam,
        answers: {},
        flags: [],
        order: {},
        start: Date.now(),
        elapsed: 0,
        ...(exam ? { limit: (opts.examMin || 180) * 60 } : {}),
      };
      persist(s);
      if (exam) setTimeLeft(s.limit ?? null);
      goQuiz();
      return true;
    },
    [questions, store, persist, goQuiz],
  );

  const studyOne = useCallback(
    (qn: number) => {
      const s: SessionState = {
        queue: [qn],
        idx: 0,
        mode: "study",
        exam: false,
        answers: {},
        flags: [],
        order: {},
        start: Date.now(),
        elapsed: 0,
      };
      setActive(null);
      setSession(s);
      setTimeLeft(null);
      goQuiz();
    },
    [setActive, goQuiz],
  );

  const resume = useCallback(() => {
    const a = store.active;
    if (!a) return;
    const s: SessionState = { ...a, start: Date.now() - (a.elapsed || 0) * 1000 };
    setSession(s);
    if (s.exam && s.limit) setTimeLeft(s.limit - (a.elapsed || 0));
    goQuiz();
  }, [store.active, goQuiz]);

  const discard = useCallback(() => {
    setActive(null);
  }, [setActive]);

  const quit = useCallback(() => {
    const s = sessRef.current;
    if (s) {
      const el = Math.round((Date.now() - s.start) / 1000);
      setActive({ ...s, elapsed: el });
    }
    setTimeLeft(null);
    onHome();
  }, [setActive, onHome]);

  // ── 선택/제출 ──────────────────────────────────────────────
  const select = useCallback(
    (k: string, multi: boolean) => {
      const s = sessRef.current;
      if (!s) return;
      const qn = s.queue[s.idx];
      // 비시험에서 이미 채점된 문항은 변경 불가
      if (!s.exam && s.answers[qn]?.ok !== undefined) return;
      const cur = s.answers[qn]?.sel ?? [];
      let sel: string[];
      if (multi) sel = cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k];
      else sel = [k];
      const answers = { ...s.answers, [qn]: { ...s.answers[qn], sel } };
      const ns = { ...s, answers };
      if (s.exam) persist(ns);
      else setSession(ns);
    },
    [persist],
  );

  const submit = useCallback(() => {
    const s = sessRef.current;
    if (!s) return;
    const qn = s.queue[s.idx];
    const d = byQn.get(qn)!;
    const sel = s.answers[qn]?.sel ?? [];
    if (!sel.length) return;
    const ok = setsEqual(sel, d.answer);
    const answers = { ...s.answers, [qn]: { sel, ok } };
    recordResult(qn, sel, ok);
    persist({ ...s, answers });
  }, [byQn, recordResult, persist]);

  const goIdx = useCallback(
    (i: number) => {
      const s = sessRef.current;
      if (!s || i < 0 || i >= s.queue.length) return;
      persist({ ...s, idx: i });
    },
    [persist],
  );

  // ── 결과 집계 ──────────────────────────────────────────────
  const doFinish = useCallback(() => {
    const s = sessRef.current;
    if (!s) return;
    const okCount = s.queue.filter((qn) => {
      const a = s.answers[qn];
      return a && (a.ok !== undefined ? a.ok : setsEqual(a.sel, byQn.get(qn)!.answer));
    }).length;
    const wrong = s.queue.filter((qn) => {
      const a = s.answers[qn];
      return !(a && (a.ok !== undefined ? a.ok : setsEqual(a.sel, byQn.get(qn)!.answer)));
    });
    pushSession({
      date: new Date().toISOString(),
      mode: s.mode,
      n: s.queue.length,
      ok: okCount,
      sec: Math.round((Date.now() - s.start) / 1000),
    });
    setActive(null);
    setTimeLeft(null);
    setSession({ ...s, _wrong: wrong });
    onResult();
  }, [byQn, pushSession, setActive, onResult]);

  const finish = doFinish;

  const finishExam = useCallback(() => {
    const s = sessRef.current;
    if (!s) return;
    // 미응답 포함 전체 채점 + 이력 기록
    s.queue.forEach((qn) => {
      const d = byQn.get(qn)!;
      const a = s.answers[qn];
      const sel = a?.sel ?? [];
      const ok = setsEqual(sel, d.answer);
      recordResult(qn, sel, ok);
    });
    doFinish();
  }, [byQn, recordResult, doFinish]);

  const next = useCallback(() => {
    const s = sessRef.current;
    if (!s) return;
    if (s.idx < s.queue.length - 1) goIdx(s.idx + 1);
    else if (!s.exam) doFinish();
  }, [goIdx, doFinish]);

  const prev = useCallback(() => {
    const s = sessRef.current;
    if (s) goIdx(s.idx - 1);
  }, [goIdx]);

  const retryWrong = useCallback(() => {
    const s = sessRef.current;
    const w = s?._wrong ?? [];
    if (!w.length) return;
    const ns: SessionState = {
      queue: shuffle(w),
      idx: 0,
      mode: "wrong",
      exam: false,
      answers: {},
      flags: [],
      order: {},
      start: Date.now(),
      elapsed: 0,
    };
    persist(ns);
    goQuiz();
  }, [persist, goQuiz]);

  const toggleFlag = useCallback(() => {
    const s = sessRef.current;
    if (!s) return;
    const flags = [...s.flags];
    const qn = s.queue[s.idx];
    const i = flags.indexOf(qn);
    if (i < 0) flags.push(qn);
    else flags.splice(i, 1);
    persist({ ...s, flags });
  }, [persist]);

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

  return {
    session,
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
