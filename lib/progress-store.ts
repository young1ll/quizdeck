import { emptyProgress, type Progress } from "./progress";

// Progress 영속의 seam. snapshot · async.
// localStorage(지금) / in-memory(테스트) / (미래) RemoteApi·composite가 같은 계약을 만족한다.
export interface ProgressStore {
  load(key: string): Promise<Progress | null>;
  save(key: string, progress: Progress): Promise<void>;
}

/** 테스트·임시용 인메모리 adapter */
export function inMemoryProgressStore(): ProgressStore {
  const m = new Map<string, string>();
  return {
    async load(key) {
      const raw = m.get(key);
      return raw ? (JSON.parse(raw) as Progress) : null;
    },
    async save(key, progress) {
      m.set(key, JSON.stringify(progress));
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
      if (raw) return JSON.parse(raw) as Progress;
      // 레거시 1회 변환 — 다음 save가 새 키를 쓰며 self-heal
      const legacy = s.getItem(LEGACY_PREFIX + key);
      return legacy ? fromLegacy(JSON.parse(legacy) as Partial<Progress>) : null;
    },
    async save(key, progress) {
      get().setItem(KEY_PREFIX + key, JSON.stringify(progress));
    },
  };
}
