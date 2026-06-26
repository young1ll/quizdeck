import type { ProgressStore, StoredProgress } from "./progress-store";

// local-first composite ProgressStore (이슈 #7 / ADR-0003).
//
// local(localStorage) 을 진실의 즉시 사본으로 두고, remote(/api/progress) 를 백그라운드로
// 동기화한다. ADR-0001 의 봉투 LWW 를 그대로 활용한다 — per-field merge 는 하지 않고,
// 양측 updatedAt 을 비교해 큰 쪽을 채택하고 진 쪽을 정렬(write-back)한다.
//
//  - save:  local 즉시 write + remote 디바운스 write(실패해도 학습 흐름을 막지 않음).
//  - load:  양측을 읽어 updated_at 이 큰 쪽을 채택, 진 쪽에 write-back.
//  - 오프라인: local 에 계속 쌓이고, remote 복귀 시 재시도 flush 로 자동 reconcile.

export type SyncState = "syncing" | "synced" | "offline";

export interface SyncStatus {
  state: SyncState;
  /** 마지막으로 remote 와 성공적으로 동기화된 시각(epoch ms). 아직 없으면 null. */
  lastSyncedAt: number | null;
}

// 동기화 상태를 surfacing 하는 옵셔널 능력. 기본 seam(ProgressStore)은 load/save 뿐이라
// localStorage·in-memory adapter 는 이걸 구현하지 않는다 — composite 만 구현하고,
// useStoreState 가 덕타이핑으로 감지해 UI 에 상태를 전달한다(ADR-0001 "seam 무변경").
export interface SyncStatusSource {
  getSyncStatus(): SyncStatus;
  /** 구독 후 변경분만 통지(즉시 호출 없음). 해제 함수를 반환. */
  subscribeSyncStatus(listener: (s: SyncStatus) => void): () => void;
}

export function isSyncStatusSource(s: unknown): s is SyncStatusSource {
  return (
    typeof s === "object" &&
    s !== null &&
    typeof (s as SyncStatusSource).subscribeSyncStatus === "function" &&
    typeof (s as SyncStatusSource).getSyncStatus === "function"
  );
}

export interface CompositeOptions {
  /** remote write 디바운스(ms). 빠른 연속 풀이에도 remote 폭주를 막는다. 기본 1500. */
  debounceMs?: number;
  /** remote 실패 후 재시도 지연(ms). 기본 = debounceMs. */
  retryMs?: number;
  /** 시각 소스(테스트 주입용). 기본 Date.now. */
  now?: () => number;
}

export function compositeProgressStore(
  local: ProgressStore,
  remote: ProgressStore,
  opts: CompositeOptions = {},
): ProgressStore & SyncStatusSource {
  const debounceMs = opts.debounceMs ?? 1500;
  const retryMs = opts.retryMs ?? debounceMs;
  const now = opts.now ?? Date.now;

  // 초기: 미동기 변경 없음 = synced(시각 미상). 마운트 직후 load 가 syncing→synced/offline 로 옮긴다.
  let status: SyncStatus = { state: "synced", lastSyncedAt: null };
  const listeners = new Set<(s: SyncStatus) => void>();

  function setStatus(next: Partial<SyncStatus>): void {
    const merged: SyncStatus = { ...status, ...next };
    if (merged.state === status.state && merged.lastSyncedAt === status.lastSyncedAt) {
      return;
    }
    status = merged;
    for (const l of listeners) l(status);
  }

  // 미동기 최신본 — key(=exam_key) 단위. 디바운스/재시도가 이 최신본을 push 한다.
  const pending = new Map<string, StoredProgress>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  function scheduleFlush(key: string, delay: number): void {
    const existing = timers.get(key);
    if (existing) clearTimeout(existing);
    timers.set(
      key,
      setTimeout(() => {
        timers.delete(key);
        void flush(key);
      }, delay),
    );
  }

  async function flush(key: string): Promise<void> {
    const job = pending.get(key);
    if (!job) return;
    setStatus({ state: "syncing" });
    try {
      await remote.save(key, job.snapshot, job.updatedAt);
      // await 중 더 최신 save 가 끼어들었으면 그 save 가 새 flush 를 예약했다 — 건드리지 않는다.
      if (pending.get(key) === job) {
        pending.delete(key);
        setStatus({ state: "synced", lastSyncedAt: now() });
      }
    } catch {
      // 실패해도 local 에 보존된 채 — pending 유지 + 재시도 예약(online 복귀 시 자동 reconcile).
      setStatus({ state: "offline" });
      scheduleFlush(key, retryMs);
    }
  }

  function enqueueRemote(key: string, snapshot: StoredProgress, delay: number): void {
    pending.set(key, snapshot);
    setStatus({ state: "syncing" });
    scheduleFlush(key, delay);
  }

  return {
    async load(key) {
      setStatus({ state: "syncing" });
      const localStored = await local.load(key);
      let remoteStored: StoredProgress | null = null;
      let remoteOk = true;
      try {
        remoteStored = await remote.load(key);
      } catch {
        remoteOk = false;
      }

      // remote 불가(오프라인/미인증) → local 로 진행, 상태 offline.
      if (!remoteOk) {
        setStatus({ state: "offline" });
        return localStored;
      }

      // 양측 읽힘 → LWW 정렬. per-field merge 없음(ADR-0001 승계).
      let winner: StoredProgress | null = localStored;
      let pushedToRemote = false;
      if (localStored && remoteStored) {
        if (remoteStored.updatedAt > localStored.updatedAt) {
          await local.save(key, remoteStored.snapshot, remoteStored.updatedAt);
          winner = remoteStored;
        } else if (localStored.updatedAt > remoteStored.updatedAt) {
          enqueueRemote(key, localStored, 0);
          pushedToRemote = true;
        }
        // 동률이면 write-back 없이 local 채택
      } else if (remoteStored) {
        // 새 기기 — 서버 snapshot pull, local 채움
        await local.save(key, remoteStored.snapshot, remoteStored.updatedAt);
        winner = remoteStored;
      } else if (localStored) {
        // 서버 비어있음 — local push
        enqueueRemote(key, localStored, 0);
        pushedToRemote = true;
      } else {
        winner = null; // 양측 없음
      }

      // remote push 를 건 경우 상태는 그 flush 가 소유(syncing→synced/offline). 그 외엔 synced 확정.
      if (!pushedToRemote) setStatus({ state: "synced", lastSyncedAt: now() });
      return winner;
    },

    async save(key, snapshot, updatedAt) {
      // local 즉시 — 학습 화면은 remote 응답을 기다리지 않는다.
      await local.save(key, snapshot, updatedAt);
      enqueueRemote(key, { snapshot, updatedAt }, debounceMs);
    },

    getSyncStatus() {
      return status;
    },
    subscribeSyncStatus(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}
