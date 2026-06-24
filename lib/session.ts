import type { Question } from "./types";
import type { Mode, QHist, Store } from "./store";

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function setsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sb = new Set(b);
  return a.every((x) => sb.has(x));
}

/** 데이터에 등장하는 주제 목록(등장 순서 유지) */
export function topicsOf(questions: Question[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const q of questions) {
    if (!seen.has(q.topic)) {
      seen.add(q.topic);
      out.push(q.topic);
    }
  }
  return out;
}

export interface TopicStat {
  n: number;
  seen: number;
  ok: number;
}

export function topicStat(
  questions: Question[],
  hist: Record<number, QHist>,
): Record<string, TopicStat> {
  const t: Record<string, TopicStat> = {};
  for (const topic of topicsOf(questions)) t[topic] = { n: 0, seen: 0, ok: 0 };
  for (const d of questions) {
    t[d.topic].n++;
    const h = hist[d.qn];
    if (h) {
      t[d.topic].seen++;
      if (h.last === "O") t[d.topic].ok++;
    }
  }
  return t;
}

/** 모드·주제 필터로 기본 풀 구성 */
export function basePool(
  questions: Question[],
  mode: Mode,
  topic: string,
  store: Store,
): Question[] {
  let p = questions.slice();
  if (topic !== "all") p = p.filter((d) => d.topic === topic);
  if (mode === "wrong") p = p.filter((d) => store.wrong.includes(d.qn));
  if (mode === "star") p = p.filter((d) => store.stars.includes(d.qn));
  return p;
}

/** 약점 가중 정렬(스마트 복습): 미학습→오답→낮은 정답률 주제 우선 */
export function smartOrder(
  pool: Question[],
  questions: Question[],
  hist: Record<number, QHist>,
): Question[] {
  const t = topicStat(questions, hist);
  const w = (d: Question): number => {
    const h = hist[d.qn];
    if (!h) return 0;
    if (h.last === "X") return 1;
    const tp = t[d.topic];
    const acc = tp.seen ? tp.ok / tp.seen : 1;
    return acc < 0.7 ? 2 : 3;
  };
  return pool
    .map((d) => [w(d), Math.random(), d] as [number, number, Question])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1])
    .map((x) => x[2]);
}

/** 문항의 보기 표시 순서(셔플 여부에 따라) */
export function dispOrder(
  options: Record<string, string>,
  shuffleOn: boolean,
  cached?: string[],
): string[] {
  const keys = Object.keys(options).sort();
  if (!shuffleOn) return keys;
  return cached ?? shuffle(keys);
}
