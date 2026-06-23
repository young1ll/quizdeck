import { describe, it, expect } from "vitest";
import {
  emptyProgress,
  mastery,
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
