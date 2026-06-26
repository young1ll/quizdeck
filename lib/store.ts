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

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function streak(days: Record<string, number>): number {
  let s = 0;
  const d = new Date();
  for (;;) {
    const k = d.toISOString().slice(0, 10);
    if (days[k]) {
      s++;
      d.setDate(d.getDate() - 1);
    } else break;
  }
  return s;
}

const ACTIVE_PREFIX = "quizdeck:active:"; // 진행 중 Session(기기-국소)
const LEGACY_PREFIX = "quizdeck:store:"; // Phase 2 통짜 blob (active 복구용)

// ── Context ───────────────────────────────────────────────────
interface StoreCtx {
  store: Store;
  loaded: boolean;
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

  // Progress 변경 → 순수 reducer 적용 + seam 저장
  const mutate = useCallback(
    (fn: (p: Progress) => Progress) => {
      setProgress((prev) => {
        const next = fn(prev);
        progressStore.save(examKey, next, Date.now()).catch(() => {});
        return next;
      });
    },
    [progressStore, examKey],
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
      setProgress(next);
      progressStore.save(examKey, next, Date.now()).catch(() => {});
      setActiveState(imported ?? null);
      persistActive(imported ?? null);
    },
    [progressStore, examKey, persistActive],
  );

  const store = useMemo<Store>(() => ({ ...progress, active }), [progress, active]);

  return {
    store,
    loaded,
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
