import { describe, it, expect } from "vitest";
import {
  accuracy,
  emptyProgress,
  mastery,
  myProblems,
  pushSession,
  recordResult,
  setMemo,
  setPrefs,
  toggleStar,
} from "./progress";
import type { SessionRecord } from "./progress";

const NOW = Date.parse("2026-06-23T10:00:00Z"); // dayKey = 2026-06-23

describe("recordResult", () => {
  it("정답이면 문항을 마지막 정답(O)으로 기록하고 오늘 활동을 센다", () => {
    const p = recordResult(emptyProgress(), 42, ["A"], true, NOW);
    expect(p.hist[42].seen).toBe(1);
    expect(p.hist[42].correct).toBe(1);
    expect(p.hist[42].last).toBe("O");
    expect(p.days["2026-06-23"]).toBe(1);
  });

  it("오답이면 Wrong-list에 편입하고 마지막 오답(X)으로 기록한다", () => {
    const p = recordResult(emptyProgress(), 42, ["B"], false, NOW);
    expect(p.hist[42].last).toBe("X");
    expect(p.wrong).toContain(42);
  });

  it("틀린 뒤 나중에 맞히면 Wrong-list에서 빠진다 (불변식)", () => {
    let p = recordResult(emptyProgress(), 42, ["B"], false, NOW);
    expect(p.wrong).toContain(42);
    p = recordResult(p, 42, ["A"], true, NOW);
    expect(p.wrong).not.toContain(42);
    expect(p.hist[42].seen).toBe(2);
  });
});

describe("mastery", () => {
  it("마지막에 정답(O)으로 맞힌 문항 비율을 전체 대비 %로 낸다", () => {
    let p = emptyProgress();
    p = recordResult(p, 1, ["A"], true, NOW); // O
    p = recordResult(p, 2, ["A"], false, NOW); // X
    p = recordResult(p, 3, ["A"], true, NOW); // O
    expect(mastery(p, 10)).toBe(20); // 2 / 10 = 20%
  });

  it("전체가 0이면 0을 낸다", () => {
    expect(mastery(emptyProgress(), 0)).toBe(0);
  });
});

describe("accuracy(정답률)", () => {
  it("전 시도 중 정답 비율(correct/attempts) — 재시도 포함", () => {
    let p = emptyProgress();
    p = recordResult(p, 1, ["A"], true, NOW); // q1 O (seen1 correct1)
    p = recordResult(p, 2, ["A"], false, NOW); // q2 X (seen1 correct0)
    p = recordResult(p, 3, ["A"], true, NOW); // q3 O (seen1 correct1)
    p = recordResult(p, 1, ["A"], true, NOW); // q1 O 재시도 (seen2 correct2)
    // attempts=4, correct=3 → 75%
    expect(accuracy(p)).toBe(75);
  });

  it("Mastery(마지막 정답 문항/총)와 다른 지표 — mastered/seen 과도 다름(리포트 정답률 버그)", () => {
    let p = emptyProgress();
    p = recordResult(p, 1, ["A"], true, NOW);
    p = recordResult(p, 2, ["A"], false, NOW);
    p = recordResult(p, 3, ["A"], true, NOW);
    p = recordResult(p, 1, ["A"], true, NOW);
    // accuracy = 3/4 = 75% · mastered=2(q1,q3 last O)/seen=3 = 67% · mastery=2/10 = 20%
    const mastered = Object.values(p.hist).filter((h) => h.last === "O").length;
    const masteredOverSeen = Math.round((mastered / Object.keys(p.hist).length) * 100);
    expect(accuracy(p)).toBe(75);
    expect(masteredOverSeen).toBe(67); // 옛 Stats 정의 — accuracy 와 다르다
    expect(accuracy(p)).not.toBe(masteredOverSeen);
  });

  it("시도가 없으면 0", () => {
    expect(accuracy(emptyProgress())).toBe(0);
  });
});

describe("기타 reducer", () => {
  it("toggleStar는 즐겨찾기를 토글한다", () => {
    let p = toggleStar(emptyProgress(), 9);
    expect(p.stars).toContain(9);
    p = toggleStar(p, 9);
    expect(p.stars).not.toContain(9);
  });

  it("setMemo는 메모를 저장하고 빈 값이면 지운다", () => {
    let p = setMemo(emptyProgress(), 9, " 핵심 ");
    expect(p.memos[9]).toBe("핵심");
    p = setMemo(p, 9, "  ");
    expect(p.memos[9]).toBeUndefined();
  });

  it("pushSession은 시도 기록을 추가하고 최근 200개로 제한한다", () => {
    const rec: SessionRecord = { date: "d", mode: "study", n: 10, ok: 8, sec: 60 };
    let p = emptyProgress();
    for (let i = 0; i < 205; i++) p = pushSession(p, rec);
    expect(p.sessions).toHaveLength(200);
  });

  it("setPrefs는 환경설정을 병합한다", () => {
    const p = setPrefs(emptyProgress(), { goal: 50 });
    expect(p.prefs.goal).toBe(50);
    expect(p.prefs.shuffle).toBe(false);
  });
});

describe("myProblems (내 문제함, ADR-0011)", () => {
  it("오답∪별표∪메모의 합집합을 낸다", () => {
    let p = emptyProgress();
    p = recordResult(p, 1, ["B"], false, NOW); // wrong
    p = toggleStar(p, 2); // star
    p = setMemo(p, 3, "메모"); // memo
    expect(myProblems(p).sort((a, b) => a - b)).toEqual([1, 2, 3]);
  });

  it("여러 축에 겹친 문항은 한 번만 센다 (중복 제거)", () => {
    let p = emptyProgress();
    p = recordResult(p, 5, ["B"], false, NOW);
    p = toggleStar(p, 5);
    p = setMemo(p, 5, "메모");
    expect(myProblems(p)).toEqual([5]);
  });

  it("빈 메모는 포함하지 않는다", () => {
    const p = setMemo(emptyProgress(), 7, "   "); // trim 후 삭제
    expect(myProblems(p)).toEqual([]);
  });

  it("오답을 맞히면 (별표·메모 없으면) 자동 이탈한다", () => {
    let p = recordResult(emptyProgress(), 9, ["B"], false, NOW);
    expect(myProblems(p)).toEqual([9]);
    p = recordResult(p, 9, ["A"], true, NOW);
    expect(myProblems(p)).toEqual([]);
  });

  it("별표가 남아 있으면 오답을 맞혀도 유지된다", () => {
    let p = recordResult(emptyProgress(), 9, ["B"], false, NOW);
    p = toggleStar(p, 9);
    p = recordResult(p, 9, ["A"], true, NOW); // wrong 에서 빠지지만 star 로 유지
    expect(myProblems(p)).toEqual([9]);
  });
});
