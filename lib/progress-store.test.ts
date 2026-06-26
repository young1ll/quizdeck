import { describe, it, expect } from "vitest";
import { emptyProgress, recordResult } from "./progress";
import {
  inMemoryProgressStore,
  localStorageProgressStore,
  type ProgressStore,
} from "./progress-store";

const NOW = Date.parse("2026-06-23T10:00:00Z");
const SAVED_AT = Date.parse("2026-06-23T11:30:00Z"); // 봉투 updatedAt — 도메인 ts와 별개

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
  it("save한 snapshot·updatedAt 봉투를 load가 round-trip한다", async () => {
    const store = make();
    const p = recordResult(emptyProgress(), 7, ["B"], false, NOW);
    await store.save("aws/sap-c02", p, SAVED_AT);
    expect(await store.load("aws/sap-c02")).toEqual({
      snapshot: p,
      updatedAt: SAVED_AT,
    });
  });

  it("재저장하면 봉투의 updatedAt이 갱신된다", async () => {
    const store = make();
    const p = emptyProgress();
    await store.save("aws/sap-c02", p, SAVED_AT);
    const later = SAVED_AT + 5_000;
    await store.save("aws/sap-c02", p, later);
    expect((await store.load("aws/sap-c02"))?.updatedAt).toBe(later);
  });

  it("모르는 key는 null을 낸다", async () => {
    expect(await make().load("없음")).toBeNull();
  });
});

describe("localStorageProgressStore — 레거시 마이그레이션", () => {
  it("옛 통짜 Store blob을 snapshot 봉투로 변환한다 (active는 버림)", async () => {
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

    const stored = await localStorageProgressStore(storage).load("aws/sap-c02");

    expect(stored?.snapshot.stars).toEqual([5]);
    expect(stored?.snapshot.hist[1].last).toBe("O");
    expect(stored?.snapshot.prefs.goal).toBe(20);
    expect(
      (stored?.snapshot as unknown as { active?: unknown }).active,
    ).toBeUndefined();
    // 레거시 blob엔 타임스탬프가 없다 — updatedAt=0(미상)으로 봉투화, 다음 save가 self-heal
    expect(stored?.updatedAt).toBe(0);
  });

  it("봉투 이전(Phase 3)의 통짜 Progress를 새 키에서 봉투로 읽어낸다", async () => {
    const storage = fakeStorage();
    const bare = recordResult(emptyProgress(), 3, ["A"], true, NOW);
    // 배포된 Phase 3은 새 키에 봉투 없이 통짜 Progress를 썼다
    storage.setItem("quizdeck:progress:aws/sap-c02", JSON.stringify(bare));

    const stored = await localStorageProgressStore(storage).load("aws/sap-c02");

    expect(stored?.snapshot).toEqual(bare);
    expect(stored?.updatedAt).toBe(0); // 미상 — 다음 save가 self-heal
  });
});
