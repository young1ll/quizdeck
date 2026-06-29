import { describe, it, expect } from "vitest";
import { dayKey, today, addDays, streak } from "./dates";

// 날짜/일자 키/연속학습일 — 전부 UTC (ADR-0007 결정 3). 활동 키를 발급하는 dayKey 가 UTC 이므로
// today/streak 도 같은 UTC 기준으로 도출돼 store(클라)·dashboard(RSC)·progress 가 한 정의를 공유한다.

describe("dayKey / today", () => {
  it("ms 타임스탬프를 UTC 일자 키로 찍는다", () => {
    expect(dayKey(Date.parse("2026-06-23T10:00:00Z"))).toBe("2026-06-23");
    // UTC 자정 직전도 그 날짜로 — 로컬 TZ 와 무관.
    expect(dayKey(Date.parse("2026-06-23T23:59:00Z"))).toBe("2026-06-23");
  });

  it("today(now) 는 dayKey(now) 와 같다", () => {
    const now = Date.parse("2026-06-29T08:00:00Z");
    expect(today(now)).toBe(dayKey(now));
    expect(today(now)).toBe("2026-06-29");
  });
});

describe("addDays", () => {
  it("월/연 경계를 가로질러 UTC 일자를 옮긴다", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
  });
});

describe("streak", () => {
  it("todayKey 부터 거꾸로 끊김 없이 이어진 일수를 센다", () => {
    expect(
      streak({ "2026-06-29": 1, "2026-06-28": 2, "2026-06-27": 1 }, "2026-06-29"),
    ).toBe(3);
  });

  it("중간이 끊기면 거기서 멈춘다", () => {
    expect(streak({ "2026-06-29": 1, "2026-06-27": 1 }, "2026-06-29")).toBe(1);
  });

  it("오늘 활동이 없으면 0", () => {
    expect(streak({ "2026-06-28": 5 }, "2026-06-29")).toBe(0);
  });

  it("값 0 은 활동으로 치지 않는다", () => {
    expect(streak({ "2026-06-29": 0 }, "2026-06-29")).toBe(0);
  });

  it("빈 days 는 0", () => {
    expect(streak({}, "2026-06-29")).toBe(0);
  });

  // 회귀: 월 경계(2/28→3/1)에서도 UTC 스텝으로 정확히 센다. 옛 store.streak 은 키는 UTC(toISOString)
  // 면서 스텝은 로컬(setDate/getDate)이라 DST 지역에서 이 경계 연속일을 오산할 수 있었다.
  it("월 경계를 가로지른 연속일을 호스트 TZ 와 무관하게 센다", () => {
    expect(
      streak({ "2026-03-01": 1, "2026-02-28": 3, "2026-02-27": 1 }, "2026-03-01"),
    ).toBe(3);
  });
});
