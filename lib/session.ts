import type { Question } from "./types";
import type { AnswerRec, Mode, QHist, SessionState, Store } from "./store";
import { myProblems } from "./progress";

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

/**
 * 채점 규칙 — **단일 출처**. 이미 채점된 답이면(a.ok) 그것을, 아니면 정답 집합과 비교. 컨트롤러 제출·
 * 결과 집계·PDF·뷰가 모두 이 함수를 쓴다(옛날엔 `a.ok ?? setsEqual(...)`가 7곳에 복붙돼 있었다).
 */
export function gradeAnswer(a: AnswerRec | undefined, answer: string[]): boolean {
  if (!a) return false;
  return a.ok !== undefined ? a.ok : setsEqual(a.sel, answer);
}

export interface WrongItem {
  qn: number;
  sel: string[]; // 틀린 문항에서 내 선택(결과·PDF 렌더용)
}

export interface QuizResult {
  okCount: number;
  total: number;
  pct: number; // round(okCount/total*100)
  wrong: WrongItem[];
  perTopic: Record<string, { n: number; ok: number }>;
}

/**
 * 세션 결과 집계(순수) — okCount·틀린 문항(+내 선택)·주제별 정답을 한 번에. 컨트롤러가 finish 시 1회
 * 계산해 result 모델로 노출하고, Result 뷰·PDF 는 재채점 대신 이 결과를 읽는다. 소요 시간(sec)은 시간
 * 의존이라 여기 없다 — 호출부(finish 시점)에서 얹는다.
 */
export interface CurrentNavItem {
  qn: number;
  answered: boolean;
  flagged: boolean;
  current: boolean;
}

// 현재 문항 뷰모델 — Quiz 화면이 raw SessionState 를 뒤지는 대신 읽는 파생 읽기. 순수·결정적이라 단위
// 테스트 가능(옛날엔 currentQuestion·selected·isGraded·isLast·isFlagged·진행·nav 를 뷰가 s.queue[s.idx]…
// 로 재파생했다). 채점 여부/정오는 gradeAnswer 단일 규칙.
export interface CurrentView {
  question: Question;
  qn: number;
  idx: number;
  total: number;
  isLast: boolean;
  selected: string[];
  isGraded: boolean; // 비시험 && 채점됨(피드백 표시)
  isCorrect: boolean; // isGraded 일 때만 의미
  isFlagged: boolean;
  exam: boolean;
  mode: Mode;
  nav: CurrentNavItem[]; // 시험 문항 네비 그리드용
}

export function currentView(
  session: SessionState,
  byQn: Map<number, Question>,
): CurrentView | null {
  const qn = session.queue[session.idx];
  const question = byQn.get(qn);
  if (!question) return null;
  const a = session.answers[qn];
  const isGraded = !session.exam && a?.ok !== undefined;
  return {
    question,
    qn,
    idx: session.idx,
    total: session.queue.length,
    isLast: session.idx === session.queue.length - 1,
    selected: a?.sel ?? [],
    isGraded,
    isCorrect: isGraded ? gradeAnswer(a, question.answer) : false,
    isFlagged: session.flags.includes(qn),
    exam: session.exam,
    mode: session.mode,
    nav: session.queue.map((q, i) => ({
      qn: q,
      answered: !!session.answers[q]?.sel?.length,
      flagged: session.flags.includes(q),
      current: i === session.idx,
    })),
  };
}

// 이어하기 배너용 요약(순수) — 허브(Home)가 저장된 진행 세션(store.active)의 raw 필드를 읽는 대신.
export function resumeInfo(
  active: SessionState | null,
): { mode: Mode; position: number; total: number } | null {
  if (!active) return null;
  return { mode: active.mode, position: active.idx + 1, total: active.queue.length };
}

export function computeResult(session: SessionState, byQn: Map<number, Question>): QuizResult {
  const perTopic: Record<string, { n: number; ok: number }> = {};
  const wrong: WrongItem[] = [];
  let okCount = 0;
  for (const qn of session.queue) {
    const d = byQn.get(qn);
    if (!d) continue;
    const a = session.answers[qn];
    const correct = gradeAnswer(a, d.answer);
    if (correct) okCount++;
    else wrong.push({ qn, sel: a?.sel ?? [] });
    perTopic[d.topic] = perTopic[d.topic] ?? { n: 0, ok: 0 };
    perTopic[d.topic].n++;
    if (correct) perTopic[d.topic].ok++;
  }
  const total = session.queue.length;
  return { okCount, total, pct: total ? Math.round((okCount / total) * 100) : 0, wrong, perTopic };
}

export interface TopicOption {
  id: string; // 안정 topicId(언어 무관) — 필터 value·조인 키
  label: string; // 현재 언어 표시 라벨
}

/**
 * 등장하는 주제 목록(등장 순서 유지) — 안정 id + 현재 언어 라벨. Setup 필터의 value 는 id 라, 언어
 * 토글로 라벨이 바뀌어도 held 선택이 살아남는다(latent 빈-세션 버그 방지). topicId 없으면 topic 폴백.
 */
export function topicsOf(questions: Question[]): TopicOption[] {
  const seen = new Set<string>();
  const out: TopicOption[] = [];
  for (const q of questions) {
    const id = q.topicId ?? q.topic;
    if (!seen.has(id)) {
      seen.add(id);
      out.push({ id, label: q.topic });
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
  // 주제별 집계 — 매 렌더 재파생하는 표시용이라 현재 언어 라벨(d.topic)로 그룹(lazy-init). topicId 는
  // held 필터(basePool)에만 필요하고 여기선 표시라 라벨 키가 맞다.
  const t: Record<string, TopicStat> = {};
  for (const d of questions) {
    t[d.topic] = t[d.topic] ?? { n: 0, seen: 0, ok: 0 };
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
  // 필터 값은 안정 topicId(Setup Selector value) — 언어 토글에도 held 선택이 맞는다. topicId 없으면 topic.
  if (topic !== "all") p = p.filter((d) => (d.topicId ?? d.topic) === topic);
  if (mode === "wrong") p = p.filter((d) => store.wrong.includes(d.qn));
  if (mode === "star") p = p.filter((d) => store.stars.includes(d.qn));
  if (mode === "mine") {
    const set = new Set(myProblems(store));
    p = p.filter((d) => set.has(d.qn));
  }
  if (mode === "memo") p = p.filter((d) => store.memos[d.qn] != null);
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
