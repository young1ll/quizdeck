"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

export type Mode = "study" | "smart" | "exam" | "wrong" | "star";

export const MODE_LABEL: Record<Mode, string> = {
  study: "학습",
  smart: "스마트 복습",
  exam: "시험 모드",
  wrong: "오답노트",
  star: "즐겨찾기",
};

export interface QHist {
  seen: number;
  correct: number;
  wrong: number;
  last: "O" | "X";
  lastSel: string[];
  ts: number;
}

export interface AnswerRec {
  sel: string[];
  ok?: boolean;
}

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

export interface SessionRecord {
  date: string;
  mode: Mode;
  n: number;
  ok: number;
  sec: number;
}

export interface Prefs {
  shuffle: boolean;
  goal: number;
}

export interface Store {
  hist: Record<number, QHist>;
  wrong: number[];
  stars: number[];
  memos: Record<number, string>;
  days: Record<string, number>;
  sessions: SessionRecord[];
  active: SessionState | null;
  prefs: Prefs;
}

export function emptyStore(): Store {
  return {
    hist: {},
    wrong: [],
    stars: [],
    memos: {},
    days: {},
    sessions: [],
    active: null,
    prefs: { shuffle: false, goal: 30 },
  };
}

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

const PREFIX = "quizdeck:store:";

// ── Context ───────────────────────────────────────────────────
interface StoreCtx {
  store: Store;
  loaded: boolean;
  /** 부분 갱신 — 함수형/객체형 모두 허용 */
  update: (mut: (s: Store) => Store) => void;
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

/** localStorage 백업 store를 관리하는 훅. StoreProvider에서 사용 */
export function useStoreState(examKey: string): StoreCtx {
  const key = PREFIX + examKey;
  const [store, setStore] = useState<Store>(emptyStore);
  const [loaded, setLoaded] = useState(false);
  const storeRef = useRef(store);
  storeRef.current = store;

  // 마운트 시 1회 로드
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Store>;
        setStore({ ...emptyStore(), ...parsed, prefs: { ...emptyStore().prefs, ...parsed.prefs } });
      }
    } catch {
      /* ignore */
    }
    setLoaded(true);
  }, [key]);

  const persist = useCallback(
    (s: Store) => {
      try {
        localStorage.setItem(key, JSON.stringify(s));
      } catch {
        /* ignore */
      }
    },
    [key],
  );

  const update = useCallback(
    (mut: (s: Store) => Store) => {
      setStore((prev) => {
        const next = mut(prev);
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const recordResult = useCallback(
    (qn: number, sel: string[], ok: boolean) => {
      update((s) => {
        const h = s.hist[qn] ?? { seen: 0, correct: 0, wrong: 0, last: "X" as const, lastSel: [], ts: 0 };
        const nh: QHist = {
          seen: h.seen + 1,
          correct: h.correct + (ok ? 1 : 0),
          wrong: h.wrong + (ok ? 0 : 1),
          last: ok ? "O" : "X",
          lastSel: sel,
          ts: Date.now(),
        };
        const wrong = [...s.wrong];
        const i = wrong.indexOf(qn);
        if (ok) {
          if (i >= 0) wrong.splice(i, 1);
        } else if (i < 0) wrong.push(qn);
        const k = today();
        return {
          ...s,
          hist: { ...s.hist, [qn]: nh },
          wrong,
          days: { ...s.days, [k]: (s.days[k] ?? 0) + 1 },
        };
      });
    },
    [update],
  );

  const toggleStar = useCallback(
    (qn: number) => {
      update((s) => {
        const stars = [...s.stars];
        const i = stars.indexOf(qn);
        if (i < 0) stars.push(qn);
        else stars.splice(i, 1);
        return { ...s, stars };
      });
    },
    [update],
  );

  const setMemo = useCallback(
    (qn: number, text: string) => {
      update((s) => {
        const memos = { ...s.memos };
        const v = text.trim();
        if (v) memos[qn] = v;
        else delete memos[qn];
        return { ...s, memos };
      });
    },
    [update],
  );

  const setActive = useCallback(
    (sess: SessionState | null) => {
      update((s) => ({ ...s, active: sess }));
    },
    [update],
  );

  const pushSession = useCallback(
    (r: SessionRecord) => {
      update((s) => {
        const sessions = [...s.sessions, r];
        if (sessions.length > 200) sessions.splice(0, sessions.length - 200);
        return { ...s, sessions };
      });
    },
    [update],
  );

  const setPrefs = useCallback(
    (p: Partial<Prefs>) => {
      update((s) => ({ ...s, prefs: { ...s.prefs, ...p } }));
    },
    [update],
  );

  const resetAll = useCallback(() => {
    update((s) => ({ ...emptyStore(), prefs: s.prefs }));
  }, [update]);

  const replaceStore = useCallback(
    (s: Store) => {
      const merged: Store = { ...emptyStore(), ...s, prefs: { ...emptyStore().prefs, ...s.prefs } };
      setStore(merged);
      persist(merged);
    },
    [persist],
  );

  return {
    store,
    loaded,
    update,
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
