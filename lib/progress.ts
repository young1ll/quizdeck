// Progress — 한 학습자의 한 Exam에 대한 durable 학습 기록.
// 모든 변경은 순수 함수(reducer)다 — React/저장소와 무관하게 테스트된다.

import { dayKey } from "./dates";

// 일자 키는 lib/dates(UTC 단일 기준, ADR-0007)로 통합 — recordResult 가 활동을 찍는 키와
// dashboard·store 의 streak 도출이 같은 정의를 공유한다. 공개 표면 유지를 위해 재노출.
export { dayKey };

export type Mode = "study" | "smart" | "exam" | "wrong" | "star" | "mine" | "memo";

export interface QHist {
  seen: number;
  correct: number;
  wrong: number;
  last: "O" | "X";
  lastSel: string[];
  ts: number;
}

export interface Prefs {
  shuffle: boolean;
  goal: number;
}

export interface SessionRecord {
  date: string;
  mode: Mode;
  n: number;
  ok: number;
  sec: number;
}

export interface Progress {
  hist: Record<number, QHist>;
  wrong: number[];
  stars: number[];
  memos: Record<number, string>;
  days: Record<string, number>;
  sessions: SessionRecord[];
  prefs: Prefs;
}

export function emptyProgress(): Progress {
  return {
    hist: {},
    wrong: [],
    stars: [],
    memos: {},
    days: {},
    sessions: [],
    prefs: { shuffle: false, goal: 30 },
  };
}

export function toggleStar(p: Progress, qn: number): Progress {
  const stars = p.stars.includes(qn)
    ? p.stars.filter((x) => x !== qn)
    : [...p.stars, qn];
  return { ...p, stars };
}

export function setMemo(p: Progress, qn: number, text: string): Progress {
  const memos = { ...p.memos };
  const v = text.trim();
  if (v) memos[qn] = v;
  else delete memos[qn];
  return { ...p, memos };
}

export function pushSession(p: Progress, rec: SessionRecord): Progress {
  const sessions = [...p.sessions, rec];
  if (sessions.length > 200) sessions.splice(0, sessions.length - 200);
  return { ...p, sessions };
}

export function setPrefs(p: Progress, patch: Partial<Prefs>): Progress {
  return { ...p, prefs: { ...p.prefs, ...patch } };
}

/** Mastery — 마지막에 정답으로 맞힌 문항 비율(%) */
export function mastery(p: Progress, total: number): number {
  if (!total) return 0;
  const mastered = Object.values(p.hist).filter((h) => h.last === "O").length;
  return Math.round((mastered / total) * 100);
}

/** 내 문제함 — 오답∪별표∪메모가 달린 문항 집합(파생, ADR-0011). '함'은 UI 은유이며 저장하지 않는다. */
export function myProblems(p: Progress): number[] {
  const s = new Set<number>(p.wrong);
  for (const qn of p.stars) s.add(qn);
  for (const qn of Object.keys(p.memos)) s.add(Number(qn));
  return [...s];
}

export function recordResult(
  p: Progress,
  qn: number,
  sel: string[],
  ok: boolean,
  now: number,
): Progress {
  const h = p.hist[qn] ?? { seen: 0, correct: 0, wrong: 0, last: "X" as const, lastSel: [], ts: 0 };
  const nh: QHist = {
    seen: h.seen + 1,
    correct: h.correct + (ok ? 1 : 0),
    wrong: h.wrong + (ok ? 0 : 1),
    last: ok ? "O" : "X",
    lastSel: sel,
    ts: now,
  };
  const wrong = ok
    ? p.wrong.filter((x) => x !== qn)
    : p.wrong.includes(qn)
      ? p.wrong
      : [...p.wrong, qn];
  const k = dayKey(now);
  return {
    ...p,
    hist: { ...p.hist, [qn]: nh },
    wrong,
    days: { ...p.days, [k]: (p.days[k] ?? 0) + 1 },
  };
}
