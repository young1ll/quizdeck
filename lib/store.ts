"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  emptyProgress,
  recordResult as applyRecordResult,
  toggleStar as applyToggleStar,
  setMemo as applySetMemo,
  pushSession as applyPushSession,
  setPrefs as applySetPrefs,
} from "./progress";
import type { Mode, Prefs, Progress, SessionRecord } from "./progress";
import {
  localStorageProgressStore,
  type ProgressStore,
} from "./progress-store";
import {
  isSyncStatusSource,
  type SyncStatus,
} from "./progress-store-composite";

// 도메인 타입은 progress 모듈이 소유 — 소비부 호환 위해 재노출
export type { Mode, Prefs, Progress, QHist, SessionRecord } from "./progress";

export const MODE_LABEL: Record<Mode, string> = {
  study: "학습",
  smart: "스마트 복습",
  exam: "시험 모드",
  wrong: "오답노트",
  star: "즐겨찾기",
};

export interface AnswerRec {
  sel: string[];
  ok?: boolean;
}

// 진행 중 Session(transient). Progress와 달리 기기-국소이며 seam을 거치지 않는다.
export interface SessionState {
  queue: number[];
  idx: number;
  mode: Mode;
  exam: boolean;
  answers: Record<number, AnswerRec>;
  flags: number[];
  order: Record<number, string[]>;
  start: number;
  elapsed: number;
  limit?: number;
  /** 결과 화면 산출용 — 마지막 오답 목록 */
  _wrong?: number[];
}

// 읽기 뷰: Progress + 진행 중 active Session. (백업/복원 입력 타입이기도 함)
export type Store = Progress & { active: SessionState | null };

// today/streak 은 lib/dates(UTC 단일 기준, ADR-0007)로 이전 — Home 등 소비부는 거기서 import.

const ACTIVE_PREFIX = "quizdeck:active:"; // 진행 중 Session(기기-국소)
const LEGACY_PREFIX = "quizdeck:store:"; // Phase 2 통짜 blob (active 복구용)

// ── Context ───────────────────────────────────────────────────
interface StoreCtx {
  store: Store;
  loaded: boolean;
  /** 동기화 상태(composite 주입 시). 익명(localStorage 단독)이면 null — 표시 안 함. */
  syncStatus: SyncStatus | null;
  recordResult: (qn: number, sel: string[], ok: boolean) => void;
  toggleStar: (qn: number) => void;
  setMemo: (qn: number, text: string) => void;
  setActive: (s: SessionState | null) => void;
  pushSession: (r: SessionRecord) => void;
  setPrefs: (p: Partial<Prefs>) => void;
  resetAll: () => void;
  replaceStore: (s: Store) => void;
}

const Ctx = createContext<StoreCtx | null>(null);

export function useStore(): StoreCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useStore must be used within StoreProvider");
  return c;
}

export { Ctx as StoreContext };

/**
 * Progress는 주입된 ProgressStore(기본 localStorage)로, 진행 중 Session은
 * 직접 localStorage로 영속한다. 테스트는 in-memory ProgressStore를 주입한다.
 */
export function useStoreState(
  examKey: string,
  injected?: ProgressStore,
  // LWW 동기화 타임스탬프 소스(테스트 주입용). 기본 Date.now. composite 의 opts.now 와는 별개 —
  // 이건 save 가 양측에 싣는 봉투 stamp(=LWW 의 결정적 입력)다.
  now: () => number = Date.now,
): StoreCtx {
  const progressStore = useMemo(
    () => injected ?? localStorageProgressStore(),
    [injected],
  );

  const [progress, setProgress] = useState<Progress>(emptyProgress);
  const [active, setActiveState] = useState<SessionState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const progressRef = useRef(progress);
  progressRef.current = progress;

  // 동기화 상태 — 주입된 store 가 SyncStatusSource(=composite)일 때만. 기본 seam 은 무관.
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(() =>
    isSyncStatusSource(progressStore) ? progressStore.getSyncStatus() : null,
  );
  useEffect(() => {
    if (!isSyncStatusSource(progressStore)) {
      setSyncStatus(null);
      return;
    }
    setSyncStatus(progressStore.getSyncStatus());
    return progressStore.subscribeSyncStatus(setSyncStatus);
  }, [progressStore]);

  // 마운트 시 1회 로드 (클라이언트 전용)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await progressStore.load(examKey);
      if (!cancelled && stored) setProgress(stored.snapshot);
      try {
        const a = window.localStorage.getItem(ACTIVE_PREFIX + examKey);
        if (a) {
          if (!cancelled) setActiveState(JSON.parse(a) as SessionState);
        } else {
          // 레거시 통짜 blob에서 active 복구
          const legacy = window.localStorage.getItem(LEGACY_PREFIX + examKey);
          if (legacy) {
            const o = JSON.parse(legacy) as { active?: SessionState | null };
            if (o.active && !cancelled) setActiveState(o.active);
          }
        }
      } catch {
        /* ignore */
      }
      if (!cancelled) setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [examKey, progressStore]);

  // Progress 변경 → 순수 reducer 적용 + seam 저장. LWW 타임스탬프(now)는 setState updater 밖에서
  // 1회 민팅하고 save 도 1회만 호출한다 — updater 안 부수효과는 StrictMode 이중호출 시 한 mutation 을
  // 두 stamp 로 두 번 save 하므로(LWW 의 결정적 입력) 밖으로 뺀다. next 는 동기 갱신되는 progressRef
  // 로 계산해 같은 tick 의 연속 mutate 가 올바로 합성되게 한다(setState updater 의 prev 누적과 동치).
  const mutate = useCallback(
    (fn: (p: Progress) => Progress) => {
      const next = fn(progressRef.current);
      progressRef.current = next;
      setProgress(next);
      progressStore.save(examKey, next, now()).catch(() => {});
    },
    [progressStore, examKey, now],
  );

  const persistActive = useCallback(
    (s: SessionState | null) => {
      try {
        if (s) window.localStorage.setItem(ACTIVE_PREFIX + examKey, JSON.stringify(s));
        else window.localStorage.removeItem(ACTIVE_PREFIX + examKey);
      } catch {
        /* ignore */
      }
    },
    [examKey],
  );

  const recordResult = useCallback(
    (qn: number, sel: string[], ok: boolean) =>
      mutate((p) => applyRecordResult(p, qn, sel, ok, Date.now())),
    [mutate],
  );
  const toggleStar = useCallback(
    (qn: number) => mutate((p) => applyToggleStar(p, qn)),
    [mutate],
  );
  const setMemo = useCallback(
    (qn: number, text: string) => mutate((p) => applySetMemo(p, qn, text)),
    [mutate],
  );
  const pushSession = useCallback(
    (r: SessionRecord) => mutate((p) => applyPushSession(p, r)),
    [mutate],
  );
  const setPrefs = useCallback(
    (patch: Partial<Prefs>) => mutate((p) => applySetPrefs(p, patch)),
    [mutate],
  );

  const setActive = useCallback(
    (s: SessionState | null) => {
      setActiveState(s);
      persistActive(s);
    },
    [persistActive],
  );

  const resetAll = useCallback(() => {
    mutate((p) => ({ ...emptyProgress(), prefs: p.prefs }));
    setActiveState(null);
    persistActive(null);
  }, [mutate, persistActive]);

  const replaceStore = useCallback(
    (s: Store) => {
      const { active: imported, ...rest } = s;
      const base = emptyProgress();
      const next: Progress = {
        ...base,
        ...rest,
        prefs: { ...base.prefs, ...rest.prefs },
      };
      progressRef.current = next;
      setProgress(next);
      progressStore.save(examKey, next, now()).catch(() => {});
      setActiveState(imported ?? null);
      persistActive(imported ?? null);
    },
    [progressStore, examKey, persistActive, now],
  );

  const store = useMemo<Store>(() => ({ ...progress, active }), [progress, active]);

  return {
    store,
    loaded,
    syncStatus,
    recordResult,
    toggleStar,
    setMemo,
    setActive,
    pushSession,
    setPrefs,
    resetAll,
    replaceStore,
  };
}
