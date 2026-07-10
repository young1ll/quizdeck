"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sessionReducer, type SessionAction } from "./session-reducer";
import { currentView, computeResult, type CurrentView, type QuizResult } from "./session";
import {
  buildMixedByIdx,
  splitSessionRecords,
  mixedExamSummary,
  type MixedItem,
} from "./mixed-session";
import type { SessionState, StoreCtx } from "./store";

// 혼합 큐 컨트롤러 (ADR-0022 S2). use-quiz 의 축소판 shell — 큐가 **인덱스**(0..n-1)라
// sessionReducer·currentView·computeResult 를 무변경 재사용하고, 실제 (examKey, qn) 은 기록
// 경계(recordResult·pushSession)에서만 번역한다(lib/mixed-session 주석 참조). 그릴링 결정:
// 완전 기록(문항→소속 시험 store) · 일회성(영속 없음 — setActive 미사용) · study 흐름 전용
// (타이머 없음) · 종료 시 시험별 SessionRecord 분할(mode="collection").
export interface MixedQuizController {
  current: CurrentView | null;
  result: QuizResult | null;
  /** finish 시점의 시험별 요약(큐 첫 등장 순) — 결과 화면 breakdown. */
  examSummary: { examKey: string; n: number; ok: number }[];
  phase: "active" | "result";
  select: (k: string, multi: boolean) => void;
  submit: () => void;
  next: () => void;
  prev: () => void;
  finish: () => void;
  retryWrong: () => void;
}

export function useMixedQuiz(
  items: MixedItem[],
  storeFor: (examKey: string) => StoreCtx | undefined,
): MixedQuizController {
  const byIdx = useRef(buildMixedByIdx(items)).current;
  const [session, setSession] = useState<SessionState | null>(null);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [examSummary, setExamSummary] = useState<{ examKey: string; n: number; ok: number }[]>([]);
  const sessRef = useRef<SessionState | null>(null);
  sessRef.current = session;

  const dispatch = useCallback((action: SessionAction): SessionState | null => {
    const next = sessionReducer(sessRef.current, action);
    setSession(next);
    return next;
  }, []);

  // 마운트 1회 시작 — 컬렉션 순서 그대로(큐 = 인덱스). 일회성이라 영속(setActive) 없음.
  const started = useRef(false);
  useEffect(() => {
    if (started.current || items.length === 0) return;
    started.current = true;
    dispatch({
      type: "start",
      queue: items.map((_, i) => i),
      mode: "collection",
      exam: false,
      now: Date.now(),
    });
  }, [items, dispatch]);

  const select = useCallback(
    (k: string, multi: boolean) => void dispatch({ type: "select", key: k, multi }),
    [dispatch],
  );

  // 채점 + 기록 라우팅 — 정답은 items[큐인덱스].question.answer, 기록은 그 문항의 시험 store 로.
  const submit = useCallback(() => {
    const s = sessRef.current;
    if (!s) return;
    const idx = s.queue[s.idx];
    const it = items[idx];
    if (!it) return;
    const next = dispatch({ type: "submit", answer: it.question.answer });
    if (!next || next === s) return; // 미선택 no-op
    const a = next.answers[idx];
    storeFor(it.examKey)?.recordResult(it.qn, a.sel, a.ok!);
  }, [items, dispatch, storeFor]);

  const next = useCallback(() => void dispatch({ type: "next" }), [dispatch]);
  const prev = useCallback(() => void dispatch({ type: "prev" }), [dispatch]);

  // 종료 — 결과 계산 + 시험별 SessionRecord 분할 push(그릴링 결정 4).
  const finish = useCallback(() => {
    const s = sessRef.current;
    if (!s) return;
    setResult(computeResult(s, byIdx));
    setExamSummary(mixedExamSummary(items, s));
    const sec = Math.max(0, Math.round((Date.now() - s.start) / 1000));
    for (const { examKey, record } of splitSessionRecords(items, s, sec, Date.now())) {
      storeFor(examKey)?.pushSession(record);
    }
  }, [items, byIdx, storeFor]);

  // 틀린 문항만 재도전 — 결과의 wrong(qn 자리 = 인덱스)을 새 큐로. 기록은 다시 라우팅된다.
  const retryWrong = useCallback(() => {
    const r = result;
    if (!r || r.wrong.length === 0) return;
    setResult(null);
    dispatch({ type: "retryWrong", queue: r.wrong.map((w) => w.qn), now: Date.now() });
  }, [result, dispatch]);

  return {
    current: session ? currentView(session, byIdx) : null,
    result,
    examSummary,
    phase: result ? "result" : "active",
    select,
    submit,
    next,
    prev,
    finish,
    retryWrong,
  };
}
