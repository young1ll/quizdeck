import { describe, it, expect } from "vitest";
import { basePool, gradeAnswer, computeResult, currentView, resumeInfo } from "./session";
import { emptyProgress } from "./progress";
import type { AnswerRec, SessionState, Store } from "./store";
import type { Question } from "./types";

function q(qn: number, topic = "t"): Question {
  return { qn, topic, q: "", options: {}, answer: [] };
}
function storeWith(patch: Partial<Store>): Store {
  return { ...emptyProgress(), active: null, ...patch };
}

describe("basePool mine (내 문제함, ADR-0011)", () => {
  const questions = [q(1), q(2), q(3), q(4)];

  it("오답∪별표∪메모에 든 문항만 남긴다", () => {
    const store = storeWith({ wrong: [1], stars: [2], memos: { 3: "m" } });
    const pool = basePool(questions, "mine", "all", store);
    expect(pool.map((d) => d.qn).sort((a, b) => a - b)).toEqual([1, 2, 3]);
  });

  it("겹친 문항도 한 번만(중복 제거) 남긴다", () => {
    const store = storeWith({ wrong: [2], stars: [2], memos: { 2: "m" } });
    const pool = basePool(questions, "mine", "all", store);
    expect(pool.map((d) => d.qn)).toEqual([2]);
  });

  it("주제 필터와 함께 교집합으로 좁힌다", () => {
    const qs = [q(1, "a"), q(2, "b"), q(3, "a")];
    const store = storeWith({ wrong: [1, 2], stars: [3] });
    const pool = basePool(qs, "mine", "a", store);
    expect(pool.map((d) => d.qn).sort((a, b) => a - b)).toEqual([1, 3]); // 2 는 topic b 라 제외
  });

  it("비어 있으면 빈 풀을 낸다", () => {
    const pool = basePool(questions, "mine", "all", storeWith({}));
    expect(pool).toEqual([]);
  });
});

describe("basePool memo (내 문제함 메모 필터, ADR-0011 Slice 3)", () => {
  const questions = [q(1), q(2), q(3), q(4)];

  it("메모가 달린 문항만 남긴다(오답·별표는 제외)", () => {
    const store = storeWith({ memos: { 2: "m", 4: "n" }, wrong: [1], stars: [3] });
    const pool = basePool(questions, "memo", "all", store);
    expect(pool.map((d) => d.qn).sort((a, b) => a - b)).toEqual([2, 4]);
  });
});

describe("gradeAnswer (단일 채점 규칙)", () => {
  it("이미 채점된 답(a.ok)이면 그것을 쓴다(정답집합 무시)", () => {
    expect(gradeAnswer({ sel: ["A"], ok: true }, ["B"])).toBe(true);
    expect(gradeAnswer({ sel: ["A"], ok: false }, ["A"])).toBe(false);
  });
  it("ok 없으면 정답 집합과 비교(순서 무관)", () => {
    expect(gradeAnswer({ sel: ["A", "C"] }, ["C", "A"])).toBe(true);
    expect(gradeAnswer({ sel: ["A"] }, ["A", "B"])).toBe(false);
  });
  it("답 없으면(미응답) 오답", () => {
    expect(gradeAnswer(undefined, ["A"])).toBe(false);
  });
});

describe("computeResult (세션 결과 집계)", () => {
  const questions: Question[] = [
    { qn: 1, topic: "보안", q: "", options: {}, answer: ["A"] },
    { qn: 2, topic: "보안", q: "", options: {}, answer: ["B"] },
    { qn: 3, topic: "비용", q: "", options: {}, answer: ["C"] },
  ];
  const byQn = new Map(questions.map((d) => [d.qn, d]));
  const sess = (answers: Record<number, AnswerRec>): SessionState => ({
    queue: [1, 2, 3],
    idx: 0,
    mode: "study",
    exam: false,
    answers,
    flags: [],
    start: 0,
    elapsed: 0,
  });

  it("okCount·pct·틀린문항(+내선택)·주제별을 한 번에", () => {
    const r = computeResult(
      sess({ 1: { sel: ["A"], ok: true }, 2: { sel: ["A"], ok: false }, 3: { sel: ["C"], ok: true } }),
      byQn,
    );
    expect(r.okCount).toBe(2);
    expect(r.total).toBe(3);
    expect(r.pct).toBe(67);
    expect(r.wrong).toEqual([{ qn: 2, sel: ["A"] }]);
    expect(r.perTopic).toEqual({ 보안: { n: 2, ok: 1 }, 비용: { n: 1, ok: 1 } });
  });

  it("미응답도 채점(오답), 내 선택은 빈 배열", () => {
    const r = computeResult(sess({ 1: { sel: ["A"], ok: true } }), byQn);
    expect(r.okCount).toBe(1);
    expect(r.wrong.map((w) => w.qn)).toEqual([2, 3]);
    expect(r.wrong[0].sel).toEqual([]);
  });

  it("ok 미채점(시험 모드처럼)이면 정답집합으로 채점", () => {
    const r = computeResult(sess({ 1: { sel: ["A"] }, 2: { sel: ["B"] }, 3: { sel: ["X"] } }), byQn);
    expect(r.okCount).toBe(2);
    expect(r.wrong.map((w) => w.qn)).toEqual([3]);
  });
});

describe("currentView (현재 문항 뷰모델)", () => {
  const questions: Question[] = [
    { qn: 10, topic: "t", q: "", options: { A: "", B: "" }, answer: ["A"] },
    { qn: 20, topic: "t", q: "", options: { A: "" }, answer: ["A"] },
  ];
  const byQn = new Map(questions.map((d) => [d.qn, d]));
  const base = (patch: Partial<SessionState>): SessionState => ({
    queue: [10, 20],
    idx: 0,
    mode: "study",
    exam: false,
    answers: {},
    flags: [],
    start: 0,
    elapsed: 0,
    ...patch,
  });

  it("현재 문항·진행·isLast", () => {
    const v = currentView(base({ idx: 0 }), byQn)!;
    expect(v.qn).toBe(10);
    expect(v.question.qn).toBe(10);
    expect(v.idx).toBe(0);
    expect(v.total).toBe(2);
    expect(v.isLast).toBe(false);
    expect(currentView(base({ idx: 1 }), byQn)!.isLast).toBe(true);
  });

  it("비시험 채점되면 isGraded·isCorrect·selected", () => {
    const v = currentView(base({ answers: { 10: { sel: ["A"], ok: true } } }), byQn)!;
    expect(v.isGraded).toBe(true);
    expect(v.isCorrect).toBe(true);
    expect(v.selected).toEqual(["A"]);
  });

  it("시험 모드는 isGraded 아님(피드백 숨김)", () => {
    const v = currentView(base({ exam: true, answers: { 10: { sel: ["A"], ok: true } } }), byQn)!;
    expect(v.isGraded).toBe(false);
    expect(v.isCorrect).toBe(false);
  });

  it("nav — 각 문항의 answered/flagged/current", () => {
    const v = currentView(base({ idx: 1, answers: { 10: { sel: ["A"] } }, flags: [20] }), byQn)!;
    expect(v.nav).toEqual([
      { qn: 10, answered: true, flagged: false, current: false },
      { qn: 20, answered: false, flagged: true, current: true },
    ]);
  });

  it("문항이 byQn 에 없으면 null", () => {
    expect(currentView(base({ queue: [999] }), byQn)).toBeNull();
  });
});

describe("resumeInfo (이어하기 요약)", () => {
  it("mode·position(idx+1)·total", () => {
    const active: SessionState = {
      queue: [1, 2, 3],
      idx: 1,
      mode: "exam",
      exam: true,
      answers: {},
      flags: [],
      start: 0,
      elapsed: 0,
    };
    expect(resumeInfo(active)).toEqual({ mode: "exam", position: 2, total: 3 });
  });
  it("null 이면 null", () => {
    expect(resumeInfo(null)).toBeNull();
  });
});
