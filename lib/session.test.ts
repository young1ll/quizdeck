import { describe, it, expect } from "vitest";
import { basePool } from "./session";
import { emptyProgress } from "./progress";
import type { Store } from "./store";
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
