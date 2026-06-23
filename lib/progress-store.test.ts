import { describe, it, expect } from "vitest";
import { emptyProgress, recordResult } from "./progress";
import {
  inMemoryProgressStore,
  localStorageProgressStore,
  type ProgressStore,
} from "./progress-store";

const NOW = Date.parse("2026-06-23T10:00:00Z");

// 최소 Storage 스텁 — jsdom 없이 localStorage adapter를 검증
function fakeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    key: (i) => [...m.keys()][i] ?? null,
  };
}

const adapters: [string, () => ProgressStore][] = [
  ["in-memory", () => inMemoryProgressStore()],
  ["localStorage", () => localStorageProgressStore(fakeStorage())],
];

describe.each(adapters)("ProgressStore 계약 — %s", (_name, make) => {
  it("save한 Progress를 load가 round-trip한다", async () => {
    const store = make();
    const p = recordResult(emptyProgress(), 7, ["B"], false, NOW);
    await store.save("aws/sap-c02", p);
    expect(await store.load("aws/sap-c02")).toEqual(p);
  });

  it("모르는 key는 null을 낸다", async () => {
    expect(await make().load("없음")).toBeNull();
  });
});

describe("localStorageProgressStore — 레거시 마이그레이션", () => {
  it("옛 통짜 Store blob을 Progress로 변환한다 (active는 버림)", async () => {
    const storage = fakeStorage();
    const legacy = {
      hist: { 1: { seen: 1, correct: 1, wrong: 0, last: "O", lastSel: ["A"], ts: NOW } },
      wrong: [],
      stars: [5],
      memos: {},
      days: { "2026-06-23": 1 },
      sessions: [],
      prefs: { shuffle: true, goal: 20 },
      active: { queue: [1, 2], idx: 1 }, // 진행 중 Session — Progress가 아님
    };
    storage.setItem("quizdeck:store:aws/sap-c02", JSON.stringify(legacy));

    const p = await localStorageProgressStore(storage).load("aws/sap-c02");

    expect(p?.stars).toEqual([5]);
    expect(p?.hist[1].last).toBe("O");
    expect(p?.prefs.goal).toBe(20);
    expect((p as unknown as { active?: unknown }).active).toBeUndefined();
  });
});
