import type { Question } from "./types";
import type { SessionState, SessionRecord } from "./store";
import { gradeAnswer } from "./session";
import { dayKey } from "./dates";

// 혼합 큐 세션의 순수 결정 (ADR-0022 S2). 큐는 **아이템 배열 인덱스**(0..n-1)로 돌린다 —
// sessionReducer·currentView·computeResult 가 number 키라 인덱스를 qn 처럼 쓰면 세션 코어를
// **무변경 재사용**하고, 실제 (examKey, qn) 은 기록 경계(recordResult·pushSession·별표·메모)에서만
// 번역한다. SAA q7 과 SAP q7 이 큐 안에서 충돌하지 않는 이유이기도 하다(인덱스는 유일).

export interface MixedItem {
  examKey: string;
  qn: number;
  question: Question;
}

/** 인덱스 → Question 맵 — currentView/computeResult 에 byQn 자리로 주입(코어 재사용). */
export function buildMixedByIdx(items: MixedItem[]): Map<number, Question> {
  return new Map(items.map((it, i) => [i, it.question]));
}

/**
 * 혼합 세션 종료 → 시험별 SessionRecord 분할(그릴링 결정 4). n=그 시험 문항 수, ok=정답 수,
 * sec 은 총 경과를 문항 수 비례 배분(문항별 시간은 추적하지 않으므로 근사), mode="collection".
 * now 주입으로 결정적 테스트.
 */
export function splitSessionRecords(
  items: MixedItem[],
  session: SessionState,
  totalSec: number,
  now: number,
): { examKey: string; record: SessionRecord }[] {
  const date = dayKey(now);
  const total = session.queue.length;
  const byExam = new Map<string, { n: number; ok: number }>();
  for (const idx of session.queue) {
    const it = items[idx];
    if (!it) continue;
    const g = byExam.get(it.examKey) ?? { n: 0, ok: 0 };
    g.n++;
    if (gradeAnswer(session.answers[idx], it.question.answer)) g.ok++;
    byExam.set(it.examKey, g);
  }
  return [...byExam.entries()].map(([examKey, g]) => ({
    examKey,
    record: {
      date,
      mode: "collection",
      n: g.n,
      ok: g.ok,
      sec: total ? Math.round((totalSec * g.n) / total) : 0,
    },
  }));
}

/** 결과 화면의 시험별 요약(정렬: 큐 첫 등장 순). */
export function mixedExamSummary(
  items: MixedItem[],
  session: SessionState,
): { examKey: string; n: number; ok: number }[] {
  const order: string[] = [];
  const byExam = new Map<string, { n: number; ok: number }>();
  for (const idx of session.queue) {
    const it = items[idx];
    if (!it) continue;
    if (!byExam.has(it.examKey)) order.push(it.examKey);
    const g = byExam.get(it.examKey) ?? { n: 0, ok: 0 };
    g.n++;
    if (gradeAnswer(session.answers[idx], it.question.answer)) g.ok++;
    byExam.set(it.examKey, g);
  }
  return order.map((examKey) => ({ examKey, ...byExam.get(examKey)! }));
}
