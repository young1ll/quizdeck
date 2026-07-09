import { describe, expect, it } from "vitest";
import {
  buildDashboard,
  examStat,
  overallStreak,
  activeExamStats,
  buildContinueList,
  totalMyProblems,
} from "./dashboard";
import { emptyProgress, type Progress, type QHist } from "./progress";
import type { ExamSummary } from "./types";

const h = (over: Partial<QHist>): QHist => ({
  seen: 1,
  correct: 1,
  wrong: 0,
  last: "O",
  lastSel: [],
  ts: 0,
  ...over,
});

describe("examStat", () => {
  it("Progress 에서 Exam 통계를 도출한다(mastery·accuracy·seen·오답·즐겨찾기·최근일)", () => {
    const p: Progress = {
      ...emptyProgress(),
      hist: {
        1: h({ seen: 2, correct: 1, wrong: 1, last: "O" }),
        2: h({ seen: 1, correct: 0, wrong: 1, last: "X" }),
      },
      wrong: [2],
      stars: [1, 5],
      sessions: [{ date: "2026-06-29", mode: "study", n: 3, ok: 1, sec: 60 }],
      days: { "2026-06-28": 3, "2026-06-29": 1 },
    };
    const s = examStat("aws/x", p, 10);
    expect(s).toMatchObject({
      examKey: "aws/x",
      total: 10,
      seen: 2,
      mastery: 10, // last==="O" 1개 / 10
      accuracy: 33, // 시도 3 중 정답 1
      wrong: 1,
      stars: 2,
      mine: 3, // 오답{2}∪별표{1,5} = {1,2,5}
      sessions: 1,
      lastActiveDay: "2026-06-29",
    });
  });

  it("학습 이력이 없으면 0/누락 안전", () => {
    const s = examStat("aws/y", emptyProgress(), 0);
    expect(s).toMatchObject({ seen: 0, mastery: 0, accuracy: 0, lastActiveDay: null });
  });
});

describe("overallStreak", () => {
  const today = "2026-06-29";
  it("여러 Exam days 합집합에서 오늘부터 연속한 날을 센다", () => {
    expect(
      overallStreak([{ "2026-06-29": 1, "2026-06-28": 2 }, { "2026-06-27": 1 }], today),
    ).toBe(3);
  });
  it("중간에 빈 날이 있으면 거기서 끊긴다", () => {
    expect(overallStreak([{ "2026-06-29": 1, "2026-06-27": 1 }], today)).toBe(1);
  });
  it("오늘 활동이 없으면 0", () => {
    expect(overallStreak([{ "2026-06-28": 5 }], today)).toBe(0);
  });
  it("기록이 없으면 0", () => {
    expect(overallStreak([], today)).toBe(0);
  });
});

describe("buildDashboard", () => {
  const mk = (over: Partial<Progress>): Progress => ({ ...emptyProgress(), ...over });

  it("활동 있는 Exam 만 최근활동 desc 로, 종합·streak 을 집계한다", () => {
    const rows = [
      {
        examKey: "aws/a",
        snapshot: mk({ hist: { 1: h({}) }, wrong: [3], stars: [1], days: { "2026-06-27": 1 } }),
      },
      {
        examKey: "aws/b",
        snapshot: mk({
          hist: { 1: h({}), 2: h({ last: "X" }) },
          wrong: [2],
          days: { "2026-06-29": 1 },
        }),
      },
      { examKey: "aws/c", snapshot: emptyProgress() }, // 활동 없음 → 제외
    ];
    const d = buildDashboard(rows, { "aws/a": 5, "aws/b": 5, "aws/c": 5 }, "2026-06-29");
    expect(d.exams.map((e) => e.examKey)).toEqual(["aws/b", "aws/a"]); // 최근활동 desc
    expect(d.totalExams).toBe(2);
    expect(d.totalSeen).toBe(3); // a:1 + b:2
    expect(d.totalWrong).toBe(2); // a:1 + b:1
    expect(d.totalStars).toBe(1);
    expect(d.totalMine).toBe(3); // a:{3,1}=2 + b:{2}=1
    expect(d.streak).toBe(1); // 오늘(b) 만, 어제 활동 없음
  });

  it("메모만 있는 Exam 도 내 문제함 활동으로 포함한다(ADR-0011)", () => {
    const rows = [{ examKey: "aws/m", snapshot: mk({ memos: { 7: "note" } }) }];
    const d = buildDashboard(rows, { "aws/m": 5 }, "2026-06-29");
    expect(d.exams.map((e) => e.examKey)).toEqual(["aws/m"]);
    expect(d.exams[0].seen).toBe(0);
    expect(d.exams[0].mine).toBe(1);
    expect(d.totalMine).toBe(1);
  });

  it("학습 이력은 없고 즐겨찾기만 있는 Exam 도 활동으로 포함한다", () => {
    const rows = [{ examKey: "aws/s", snapshot: mk({ stars: [1, 2] }) }];
    const d = buildDashboard(rows, { "aws/s": 5 }, "2026-06-29");
    expect(d.exams.map((e) => e.examKey)).toEqual(["aws/s"]);
    expect(d.exams[0].seen).toBe(0);
    expect(d.exams[0].stars).toBe(2);
    expect(d.totalStars).toBe(2);
  });

  it("기록이 전혀 없으면 빈 대시보드", () => {
    const d = buildDashboard([], {}, "2026-06-29");
    expect(d).toMatchObject({ exams: [], totalExams: 0, streak: 0, totalSeen: 0 });
  });
});

describe("activeExamStats", () => {
  const mk = (over: Partial<Progress>): Progress => ({ ...emptyProgress(), ...over });
  it("활동 Exam 만 최근활동 desc(streak·today 무관)", () => {
    const rows = [
      { examKey: "aws/a", snapshot: mk({ hist: { 1: h({}) }, days: { "2026-06-27": 1 } }) },
      { examKey: "aws/b", snapshot: mk({ hist: { 1: h({}) }, days: { "2026-06-29": 1 } }) },
      { examKey: "aws/c", snapshot: emptyProgress() }, // 활동 없음 → 제외
    ];
    expect(
      activeExamStats(rows, { "aws/a": 5, "aws/b": 5, "aws/c": 5 }).map((e) => e.examKey),
    ).toEqual(["aws/b", "aws/a"]);
  });
});

describe("buildContinueList", () => {
  const mk = (over: Partial<Progress>): Progress => ({ ...emptyProgress(), ...over });
  const ex = (provider: string, slug: string, questionCount = 5): ExamSummary => ({
    provider,
    providerName: provider.toUpperCase(),
    slug,
    code: `${slug}-CODE`,
    name: `${slug} name`,
    questionCount,
  });
  const exams: ExamSummary[] = [ex("aws", "a"), ex("aws", "b"), ex("aws", "c")];
  const active = (day: string) => mk({ hist: { 1: h({}) }, days: { [day]: 1 } });

  it("활동 Exam 을 최근순으로 exam 메타와 함께 싣는다", () => {
    const rows = [
      { examKey: "aws/a", snapshot: active("2026-06-27") },
      { examKey: "aws/b", snapshot: active("2026-06-29") },
    ];
    const cont = buildContinueList(rows, exams, 3);
    expect(cont.map((c) => c.exam.slug)).toEqual(["b", "a"]); // 최근순
    expect(cont[0].exam.code).toBe("b-CODE"); // 메타 조인
  });

  it("max 로 자른다", () => {
    const rows = [
      { examKey: "aws/a", snapshot: active("2026-06-27") },
      { examKey: "aws/b", snapshot: active("2026-06-29") },
    ];
    expect(buildContinueList(rows, exams, 1).map((c) => c.exam.slug)).toEqual(["b"]);
  });

  it("카탈로그에 없는 examKey 는 걸러낸다", () => {
    const rows = [{ examKey: "aws/gone", snapshot: active("2026-06-29") }];
    expect(buildContinueList(rows, exams, 3)).toEqual([]);
  });

  it("활동 없는 Exam·빈 rows 는 재개 없음", () => {
    expect(buildContinueList([], exams, 3)).toEqual([]);
    expect(buildContinueList([{ examKey: "aws/a", snapshot: emptyProgress() }], exams, 3)).toEqual(
      [],
    );
  });

  it("mastery·mine 을 examStat 정의대로 싣는다", () => {
    const rows = [
      {
        examKey: "aws/a",
        snapshot: mk({ hist: { 1: h({ last: "O" }) }, wrong: [2], stars: [3], days: { "2026-06-29": 1 } }),
      },
    ];
    const [c] = buildContinueList(rows, exams, 3);
    expect(c.mastery).toBe(20); // last O 1개 / total 5
    expect(c.mine).toBe(2); // 오답{2}∪별표{3}
  });
});

describe("totalMyProblems", () => {
  const mk = (over: Partial<Progress>): Progress => ({ ...emptyProgress(), ...over });

  it("전 시험 내 문제함(오답∪별표∪메모) 합계 — /me totalMine 과 같은 정의", () => {
    const rows = [
      { snapshot: mk({ wrong: [1, 2], stars: [2], memos: { 3: "메모" } }) }, // union {1,2,3}
      { snapshot: mk({ stars: [7] }) },
    ];
    expect(totalMyProblems(rows)).toBe(4);
  });

  it("빈 rows·활동 없는 Progress 는 0 — 홈이 진입점을 숨기는 조건", () => {
    expect(totalMyProblems([])).toBe(0);
    expect(totalMyProblems([{ snapshot: emptyProgress() }])).toBe(0);
  });
});
