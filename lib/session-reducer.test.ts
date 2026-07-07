import { describe, it, expect } from "vitest";
import { sessionReducer, stampElapsed, type SessionAction } from "./session-reducer";
import type { SessionState } from "./store";

// 순수 상태 전이 테스트 (아키텍처 리뷰 — use-quiz God-controller 분해). 전엔 전이가 훅에 얽혀 exam 모드·
// resume·경계·null 가드가 무테스트였다. reducer 는 순수라 React·store 없이 now 주입만으로 결정적 검증.

const T0 = 1_000_000; // 고정 시각

const studySession = (over: Partial<SessionState> = {}): SessionState => ({
  queue: [1, 2, 3], idx: 0, mode: "study", exam: false, answers: {}, flags: [], start: T0, elapsed: 0, ...over,
});
const examSession = (over: Partial<SessionState> = {}): SessionState => ({
  queue: [1, 2, 3], idx: 0, mode: "exam", exam: true, answers: {}, flags: [], start: T0, elapsed: 0, limit: 3600, ...over,
});

describe("sessionReducer — 순수 상태 전이", () => {
  describe("start", () => {
    it("study: queue·idx0·start=now·빈 answers, limit 없음", () => {
      const s = sessionReducer(null, { type: "start", queue: [5, 6], mode: "study", exam: false, now: T0 });
      expect(s).toMatchObject({ queue: [5, 6], idx: 0, mode: "study", exam: false, answers: {}, flags: [], start: T0, elapsed: 0 });
      expect(s?.limit).toBeUndefined();
    });
    it("exam: limit 세팅", () => {
      const s = sessionReducer(null, { type: "start", queue: [1], mode: "exam", exam: true, limit: 1800, now: T0 });
      expect(s).toMatchObject({ exam: true, limit: 1800 });
    });
  });

  it("studyOne: 단일 문항 study 세션", () => {
    const s = sessionReducer(null, { type: "studyOne", qn: 42, now: T0 });
    expect(s).toMatchObject({ queue: [42], idx: 0, mode: "study", exam: false, start: T0 });
  });

  it("resume: elapsed 만큼 start 를 당겨 타이머 연속(나머지 보존)", () => {
    const active = examSession({ elapsed: 120, idx: 2, start: 999, answers: { 1: { sel: ["A"] } } });
    const s = sessionReducer(null, { type: "resume", active, now: T0 });
    expect(s?.start).toBe(T0 - 120 * 1000);
    expect(s?.idx).toBe(2);
    expect(s?.answers[1].sel).toEqual(["A"]);
  });

  describe("select", () => {
    it("단일: 선택 교체", () => {
      expect(sessionReducer(studySession(), { type: "select", key: "B", multi: false })?.answers[1].sel).toEqual(["B"]);
    });
    it("복수: 토글 온/오프", () => {
      let s = sessionReducer(studySession(), { type: "select", key: "A", multi: true });
      s = sessionReducer(s, { type: "select", key: "C", multi: true });
      expect(s?.answers[1].sel).toEqual(["A", "C"]);
      s = sessionReducer(s, { type: "select", key: "A", multi: true });
      expect(s?.answers[1].sel).toEqual(["C"]);
    });
    it("비시험 채점 후 잠금(no-op, 같은 참조)", () => {
      const graded = studySession({ answers: { 1: { sel: ["A"], ok: true } } });
      expect(sessionReducer(graded, { type: "select", key: "B", multi: false })).toBe(graded);
    });
    it("시험은 채점 전이라 자유 변경", () => {
      const s = sessionReducer(examSession({ answers: { 1: { sel: ["A"] } } }), { type: "select", key: "B", multi: false });
      expect(s?.answers[1].sel).toEqual(["B"]);
    });
  });

  describe("submit", () => {
    it("정답 → ok:true", () => {
      expect(sessionReducer(studySession({ answers: { 1: { sel: ["A"] } } }), { type: "submit", answer: ["A"] })?.answers[1]).toEqual({ sel: ["A"], ok: true });
    });
    it("오답 → ok:false (집합 비교)", () => {
      expect(sessionReducer(studySession({ answers: { 1: { sel: ["B"] } } }), { type: "submit", answer: ["A", "B"] })?.answers[1]).toEqual({ sel: ["B"], ok: false });
    });
    it("미선택 → no-op", () => {
      const st = studySession();
      expect(sessionReducer(st, { type: "submit", answer: ["A"] })).toBe(st);
    });
  });

  describe("next/prev/navTo — idx 경계", () => {
    it("next: idx+1", () => {
      expect(sessionReducer(studySession({ idx: 0 }), { type: "next" })?.idx).toBe(1);
    });
    it("next: 마지막이면 no-op(같은 참조)", () => {
      const last = studySession({ idx: 2 });
      expect(sessionReducer(last, { type: "next" })).toBe(last);
    });
    it("prev: idx-1; 0 이면 no-op", () => {
      expect(sessionReducer(studySession({ idx: 2 }), { type: "prev" })?.idx).toBe(1);
      const first = studySession({ idx: 0 });
      expect(sessionReducer(first, { type: "prev" })).toBe(first);
    });
    it("navTo: 유효 idx; 범위 밖 no-op", () => {
      expect(sessionReducer(studySession(), { type: "navTo", idx: 2 })?.idx).toBe(2);
      const st = studySession();
      expect(sessionReducer(st, { type: "navTo", idx: 9 })).toBe(st);
      expect(sessionReducer(st, { type: "navTo", idx: -1 })).toBe(st);
    });
  });

  it("toggleFlag: 현재 문항 추가 후 제거", () => {
    let s = sessionReducer(examSession({ idx: 1 }), { type: "toggleFlag" });
    expect(s?.flags).toEqual([2]);
    s = sessionReducer(s, { type: "toggleFlag" });
    expect(s?.flags).toEqual([]);
  });

  it("retryWrong: wrong 모드 새 세션", () => {
    expect(sessionReducer(null, { type: "retryWrong", queue: [7, 9], now: T0 })).toMatchObject({ queue: [7, 9], mode: "wrong", exam: false, idx: 0, start: T0 });
  });

  describe("null 가드 — 세션 없이 mutation 은 null", () => {
    const guards: SessionAction[] = [
      { type: "select", key: "A", multi: false },
      { type: "submit", answer: ["A"] },
      { type: "next" },
      { type: "prev" },
      { type: "navTo", idx: 0 },
      { type: "toggleFlag" },
    ];
    it.each(guards.map((a) => [a.type, a] as const))("%s → null", (_t, a) => {
      expect(sessionReducer(null, a)).toBeNull();
    });
  });

  it("stampElapsed: elapsed = round((now-start)/1000)", () => {
    expect(stampElapsed(examSession({ start: T0 }), T0 + 65_400).elapsed).toBe(65);
  });
});
