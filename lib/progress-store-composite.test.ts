import { describe, it, expect, vi, afterEach } from "vitest";
import { emptyProgress, recordResult, type Progress } from "./progress";
import { inMemoryProgressStore, type ProgressStore } from "./progress-store";
import {
  compositeProgressStore,
  isSyncStatusSource,
  type SyncStatus,
} from "./progress-store-composite";

const NOW = Date.parse("2026-06-23T10:00:00Z");

function p(qn: number): Progress {
  return recordResult(emptyProgress(), qn, ["A"], true, NOW);
}

// remote 스텁 — online 토글로 오프라인을 흉내내고 호출수를 센다.
function makeRemote() {
  const inner = inMemoryProgressStore();
  let online = true;
  const calls = { load: 0, save: 0 };
  const store: ProgressStore = {
    async load(key) {
      calls.load++;
      if (!online) throw new Error("offline");
      return inner.load(key);
    },
    async save(key, snapshot, updatedAt) {
      calls.save++;
      if (!online) throw new Error("offline");
      return inner.save(key, snapshot, updatedAt);
    },
  };
  return { store, inner, calls, setOnline: (v: boolean) => void (online = v) };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("compositeProgressStore — local-first save", () => {
  it("save는 local에 즉시 쓰고 remote는 디바운스한다", async () => {
    vi.useFakeTimers();
    const local = inMemoryProgressStore();
    const remote = makeRemote();
    const c = compositeProgressStore(local, remote.store, { debounceMs: 1500 });

    await c.save("k", p(1), 5000);

    // local 은 즉시 — 학습 화면이 remote 응답을 기다리지 않는다
    expect((await local.load("k"))?.snapshot).toEqual(p(1));
    expect(remote.calls.save).toBe(0); // 아직 디바운스 창 안

    await vi.advanceTimersByTimeAsync(1500);
    expect(remote.calls.save).toBe(1);
  });

  it("빠른 연속 save가 한 번의 remote write로 합쳐진다 (디바운스)", async () => {
    vi.useFakeTimers();
    const local = inMemoryProgressStore();
    const remote = makeRemote();
    const c = compositeProgressStore(local, remote.store, { debounceMs: 1500 });

    await c.save("k", p(1), 5000);
    await c.save("k", p(2), 6000);
    await c.save("k", p(3), 7000);
    expect(remote.calls.save).toBe(0);

    await vi.advanceTimersByTimeAsync(1500);
    expect(remote.calls.save).toBe(1);
    // 마지막 snapshot·updatedAt 만 push
    expect((await remote.inner.load("k"))?.snapshot).toEqual(p(3));
    expect((await remote.inner.load("k"))?.updatedAt).toBe(7000);
  });

  it("동기화 단위가 (Exam) 독립 — 서로 다른 exam_key는 섞이지 않는다", async () => {
    vi.useFakeTimers();
    const local = inMemoryProgressStore();
    const remote = makeRemote();
    const c = compositeProgressStore(local, remote.store, { debounceMs: 1500 });

    await c.save("examA", p(1), 5000);
    await c.save("examB", p(2), 6000);
    await vi.advanceTimersByTimeAsync(1500);

    expect((await remote.inner.load("examA"))?.snapshot).toEqual(p(1));
    expect((await remote.inner.load("examB"))?.snapshot).toEqual(p(2));
  });
});

describe("compositeProgressStore — load LWW", () => {
  it("새 기기(local 비어있음)는 서버 snapshot을 pull해 local에 채운다", async () => {
    const local = inMemoryProgressStore();
    const remote = makeRemote();
    await remote.inner.save("k", p(9), 9000);
    const c = compositeProgressStore(local, remote.store, { now: () => 10000 });

    const got = await c.load("k");

    expect(got?.snapshot).toEqual(p(9));
    expect((await local.load("k"))?.snapshot).toEqual(p(9)); // write-back
    expect((await local.load("k"))?.updatedAt).toBe(9000);
    expect(c.getSyncStatus()).toEqual({ state: "synced", lastSyncedAt: 10000 });
  });

  it("remote가 더 최신이면 remote가 이기고 local에 정렬(write-back)된다", async () => {
    const local = inMemoryProgressStore();
    const remote = makeRemote();
    await local.save("k", p(1), 5000);
    await remote.inner.save("k", p(2), 8000);
    const c = compositeProgressStore(local, remote.store);

    const got = await c.load("k");

    expect(got?.snapshot).toEqual(p(2));
    expect((await local.load("k"))?.updatedAt).toBe(8000);
  });

  it("local이 더 최신이면 local이 이기고 remote에 정렬(push)된다", async () => {
    vi.useFakeTimers();
    const local = inMemoryProgressStore();
    const remote = makeRemote();
    await local.save("k", p(1), 9000);
    await remote.inner.save("k", p(2), 5000);
    const c = compositeProgressStore(local, remote.store);

    const got = await c.load("k");
    expect(got?.snapshot).toEqual(p(1));

    await vi.advanceTimersByTimeAsync(0); // 백그라운드 push
    expect((await remote.inner.load("k"))?.snapshot).toEqual(p(1));
    expect((await remote.inner.load("k"))?.updatedAt).toBe(9000);
  });

  it("동률(updatedAt 같음)이면 write-back하지 않는다", async () => {
    const local = inMemoryProgressStore();
    const remote = makeRemote();
    await local.save("k", p(1), 7000);
    await remote.inner.save("k", p(2), 7000);
    const c = compositeProgressStore(local, remote.store);

    const got = await c.load("k");
    expect(got?.updatedAt).toBe(7000);
    // local 은 그대로 — 덮어쓰지 않음
    expect((await local.load("k"))?.snapshot).toEqual(p(1));
    expect(remote.calls.save).toBe(0);
  });
});

describe("compositeProgressStore — 오프라인/reconcile", () => {
  it("remote가 오프라인이면 load는 local을 반환하고 상태가 offline", async () => {
    const local = inMemoryProgressStore();
    const remote = makeRemote();
    await local.save("k", p(1), 5000);
    remote.setOnline(false);
    const c = compositeProgressStore(local, remote.store);

    const got = await c.load("k");

    expect(got?.snapshot).toEqual(p(1));
    expect(c.getSyncStatus().state).toBe("offline");
  });

  it("오프라인 save는 local에 쌓이고, online 복귀 시 자동 reconcile된다", async () => {
    vi.useFakeTimers();
    const local = inMemoryProgressStore();
    const remote = makeRemote();
    const c = compositeProgressStore(local, remote.store, {
      debounceMs: 1500,
      retryMs: 1500,
    });

    remote.setOnline(false);
    await c.save("k", p(1), 5000);
    await vi.advanceTimersByTimeAsync(1500); // flush 시도 → 실패

    expect(c.getSyncStatus().state).toBe("offline");
    expect((await local.load("k"))?.snapshot).toEqual(p(1)); // local 보존

    remote.setOnline(true);
    await vi.advanceTimersByTimeAsync(1500); // 재시도 flush → 성공

    expect((await remote.inner.load("k"))?.snapshot).toEqual(p(1));
    expect(c.getSyncStatus().state).toBe("synced");
  });
});

describe("compositeProgressStore — 동기화 상태 노출", () => {
  it("save→syncing, flush 성공→synced 로 구독자에게 통지한다", async () => {
    vi.useFakeTimers();
    const local = inMemoryProgressStore();
    const remote = makeRemote();
    const c = compositeProgressStore(local, remote.store, { debounceMs: 1500 });

    const seen: SyncStatus[] = [];
    const off = c.subscribeSyncStatus((s) => seen.push(s));

    await c.save("k", p(1), 5000);
    expect(c.getSyncStatus().state).toBe("syncing");

    await vi.advanceTimersByTimeAsync(1500);
    expect(c.getSyncStatus().state).toBe("synced");

    expect(seen.some((s) => s.state === "syncing")).toBe(true);
    expect(seen.some((s) => s.state === "synced")).toBe(true);
    off();
  });

  it("isSyncStatusSource는 composite만 식별한다 (기본 seam은 비대상)", () => {
    const c = compositeProgressStore(inMemoryProgressStore(), makeRemote().store);
    expect(isSyncStatusSource(c)).toBe(true);
    expect(isSyncStatusSource(inMemoryProgressStore())).toBe(false);
    expect(isSyncStatusSource(null)).toBe(false);
  });
});
