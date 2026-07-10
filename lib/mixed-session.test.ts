import { describe, expect, it } from "vitest";
import { buildMixedByIdx, splitSessionRecords, mixedExamSummary, type MixedItem } from "./mixed-session";
import type { SessionState } from "./store";
import type { Question } from "./types";

const q = (qn: number, answer: string[]): Question => ({
  qn,
  topic: "t",
  q: `문항 ${qn}`,
  options: { A: "a", B: "b" },
  answer,
});

// SAA q7 과 SAP q7 이 공존 — 인덱스 큐가 충돌을 없앤다(모듈 주석의 존재 이유).
const items: MixedItem[] = [
  { examKey: "aws/saa-c03", qn: 7, question: q(7, ["A"]) },
  { examKey: "aws/sap-c02", qn: 7, question: q(7, ["B"]) },
  { examKey: "aws/saa-c03", qn: 20, question: q(20, ["A"]) },
];

const session = (answers: SessionState["answers"]): SessionState => ({
  queue: [0, 1, 2],
  idx: 2,
  mode: "collection",
  exam: false,
  answers,
  flags: [],
  start: 0,
  elapsed: 0,
});

describe("buildMixedByIdx", () => {
  it("인덱스 → Question — 같은 qn 도 인덱스로 유일(코어 재사용의 전제)", () => {
    const m = buildMixedByIdx(items);
    expect(m.get(0)!.answer).toEqual(["A"]);
    expect(m.get(1)!.answer).toEqual(["B"]); // SAP q7 — SAA q7 과 다른 항목
    expect(m.size).toBe(3);
  });
});

describe("splitSessionRecords (시험별 분할, 그릴링 결정 4)", () => {
  it("시험별 n·ok 와 문항수 비례 sec, mode=collection", () => {
    // 정답: idx0 O(A), idx1 X(A≠B), idx2 O(A) → SAA 2/2, SAP 0/1
    const s = session({ 0: { sel: ["A"], ok: true }, 1: { sel: ["A"], ok: false }, 2: { sel: ["A"], ok: true } });
    const recs = splitSessionRecords(items, s, 90, Date.UTC(2026, 6, 10));
    expect(recs).toEqual([
      { examKey: "aws/saa-c03", record: { date: "2026-07-10", mode: "collection", n: 2, ok: 2, sec: 60 } },
      { examKey: "aws/sap-c02", record: { date: "2026-07-10", mode: "collection", n: 1, ok: 0, sec: 30 } },
    ]);
  });

  it("미제출 문항은 오답으로 집계(세션 종료 시맨틱 — per-exam computeResult 와 동일)", () => {
    const s = session({ 0: { sel: ["A"], ok: true } }); // 1·2 미제출
    const recs = splitSessionRecords(items, s, 30, Date.UTC(2026, 6, 10));
    expect(recs.find((r) => r.examKey === "aws/saa-c03")!.record).toMatchObject({ n: 2, ok: 1 });
    expect(recs.find((r) => r.examKey === "aws/sap-c02")!.record).toMatchObject({ n: 1, ok: 0 });
  });
});

describe("mixedExamSummary", () => {
  it("큐 첫 등장 순으로 시험별 요약", () => {
    const s = session({ 0: { sel: ["A"], ok: true }, 1: { sel: ["B"], ok: true } });
    expect(mixedExamSummary(items, s)).toEqual([
      { examKey: "aws/saa-c03", n: 2, ok: 1 }, // idx2 미제출 → 오답
      { examKey: "aws/sap-c02", n: 1, ok: 1 },
    ]);
  });
});
