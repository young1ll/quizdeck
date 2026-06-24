import { emptyProgress, type Progress } from "./progress";

// 봉투: 동기화 메타(updatedAt)를 도메인 snapshot과 분리해 나른다.
// V2의 LWW 병합이 양측 타임스탬프를 비교하려면 seam이 이 봉투를 surfacing해야 한다.
// 도메인 Progress는 동기화 메타를 떠안지 않는다 — DB의 snapshot jsonb / updated_at 컬럼 분리와 정합.
export interface StoredProgress {
  snapshot: Progress;
  updatedAt: number;
}

// Progress 영속의 seam. snapshot 봉투 · async.
// localStorage(지금) / in-memory(테스트) / (미래) RemoteApi·composite가 같은 계약을 만족한다.
export interface ProgressStore {
  load(key: string): Promise<StoredProgress | null>;
  save(key: string, snapshot: Progress, updatedAt: number): Promise<void>;
}

/** 테스트·임시용 인메모리 adapter */
export function inMemoryProgressStore(): ProgressStore {
  const m = new Map<string, string>();
  return {
    async load(key) {
      const raw = m.get(key);
      return raw ? (JSON.parse(raw) as StoredProgress) : null;
    },
    async save(key, snapshot, updatedAt) {
      m.set(key, JSON.stringify({ snapshot, updatedAt } satisfies StoredProgress));
    },
  };
}

const KEY_PREFIX = "quizdeck:progress:";
const LEGACY_PREFIX = "quizdeck:store:"; // Phase 2의 통짜 Store blob

// 레거시 통짜 blob → Progress. active(진행 중 Session)는 버린다.
function fromLegacy(o: Partial<Progress>): Progress {
  const base = emptyProgress();
  return {
    hist: o.hist ?? base.hist,
    wrong: o.wrong ?? base.wrong,
    stars: o.stars ?? base.stars,
    memos: o.memos ?? base.memos,
    days: o.days ?? base.days,
    sessions: o.sessions ?? base.sessions,
    prefs: { ...base.prefs, ...o.prefs },
  };
}

// 새 키의 두 형태를 봉투로 정규화한다:
//  - 봉투 { snapshot, updatedAt } (이번 버전 이후)
//  - 봉투 이전(Phase 3)이 남긴 통짜 Progress — updatedAt=0(미상)으로 감싼다
// 어느 쪽이든 다음 save가 봉투로 self-heal한다.
function toStored(parsed: unknown): StoredProgress {
  const o = parsed as Record<string, unknown>;
  if (o && typeof o === "object" && "snapshot" in o) {
    return {
      snapshot: o.snapshot as Progress,
      updatedAt: typeof o.updatedAt === "number" ? o.updatedAt : 0,
    };
  }
  return { snapshot: parsed as Progress, updatedAt: 0 };
}

/**
 * 기본 adapter. Storage는 지연 해석(기본 window.localStorage)이라 SSR-safe하다 —
 * 팩토리는 window를 만지지 않고, load/save(클라이언트 실행 시점)에만 접근한다.
 * 테스트는 fake Storage를 주입한다.
 */
export function localStorageProgressStore(storage?: Storage): ProgressStore {
  const get = () => storage ?? window.localStorage;
  return {
    async load(key) {
      const s = get();
      const raw = s.getItem(KEY_PREFIX + key);
      if (raw) return toStored(JSON.parse(raw));
      // 레거시 1회 변환 — 다음 save가 새 키(봉투)를 쓰며 self-heal.
      // 레거시 blob엔 타임스탬프가 없어 updatedAt=0(미상)으로 봉투화한다.
      const legacy = s.getItem(LEGACY_PREFIX + key);
      return legacy
        ? { snapshot: fromLegacy(JSON.parse(legacy) as Partial<Progress>), updatedAt: 0 }
        : null;
    },
    async save(key, snapshot, updatedAt) {
      get().setItem(
        KEY_PREFIX + key,
        JSON.stringify({ snapshot, updatedAt } satisfies StoredProgress),
      );
    },
  };
}
