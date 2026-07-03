import { describe, it, expect } from "vitest";
import { examView } from "./exam-view";
import { emptyProgress, recordResult, toggleStar, setMemo } from "./progress";
import type { Question } from "./types";

const NOW = Date.parse("2026-06-23T10:00:00Z"); // dayKey = 2026-06-23
const TODAY = "2026-06-23";

// 최소 Question fixture — examView 는 qn·topic 만 본다(정답 판정은 recordResult 가 주입받은 ok 로).
const q = (qn: number, topic: string): Question => ({
  qn,
  topic,
  q: "",
  options: { A: "a" },
  answer: ["A"],
});

const QUESTIONS: Question[] = [
  q(1, "🔐 보안"),
  q(2, "🔐 보안"),
  q(3, "🔐 보안"),
  q(4, "💰 비용"),
  q(5, "💰 비용"),
];

describe("examView (per-exam 뷰모델)", () => {
  it("빈 Progress → 0/빈 지표", () => {
    const v = examView(emptyProgress(), QUESTIONS, 5, TODAY);
    expect(v).toMatchObject({
      total: 5,
      seen: 0,
      mastery: 0,
      accuracy: 0,
      wrong: 0,
      stars: 0,
      mine: 0,
      memos: 0,
      streak: 0,
      todayCount: 0,
      weakTopics: [],
    });
  });

  it("mastery·accuracy·카운트·연속일을 조립(정의는 progress/dates 재사용)", () => {
    let p = emptyProgress();
    p = recordResult(p, 1, ["A"], true, NOW); // 보안 O
    p = recordResult(p, 2, ["A"], false, NOW); // 보안 X (오답 편입)
    p = recordResult(p, 3, ["A"], true, NOW); // 보안 O
    p = recordResult(p, 1, ["A"], true, NOW); // 보안 q1 재시도 O
    p = toggleStar(p, 4); // 별표
    p = setMemo(p, 5, "메모"); // 메모
    const v = examView(p, QUESTIONS, 5, TODAY);
    expect(v.seen).toBe(3); // hist 있는 문항: 1,2,3
    expect(v.mastery).toBe(40); // 마지막 O: q1,q3 = 2 / 총 5 = 40%
    expect(v.accuracy).toBe(75); // correct 3 / attempts 4
    expect(v.wrong).toEqual(1); // q2
    expect(v.stars).toBe(1); // q4
    expect(v.memos).toBe(1); // q5
    expect(v.mine).toBe(3); // 오답 q2 ∪ 별표 q4 ∪ 메모 q5
    expect(v.streak).toBe(1); // 오늘 활동
    expect(v.todayCount).toBe(4); // recordResult 4회(같은 날)
  });

  it("weakTopics — seen≥3·정답률<70%만, 접두 이모지 제거", () => {
    let p = emptyProgress();
    // 보안: 3문항 중 1정답(33%<70%, seen3) → weak
    p = recordResult(p, 1, ["A"], true, NOW);
    p = recordResult(p, 2, ["A"], false, NOW);
    p = recordResult(p, 3, ["A"], false, NOW);
    // 비용: 2문항만 학습(seen2<3) → 제외
    p = recordResult(p, 4, ["A"], false, NOW);
    p = recordResult(p, 5, ["A"], false, NOW);
    const v = examView(p, QUESTIONS, 5, TODAY);
    expect(v.weakTopics).toEqual(["보안"]); // 이모지 접두 제거, 비용은 seen<3 제외
  });
});
