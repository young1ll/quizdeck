import type { Question, Concept } from "./types";
import {
  toQuestionSlot,
  toConceptSlot,
  type LocalizedQuestion,
  type LocalizedConcept,
} from "./content-localize";

// 어드민 편집기 도메인 결정 — 순수·클라-safe (아키텍처 리뷰 C2). 그동안 이 로직(채번·낙관적 병합·
// 옵션/정답 상태기계·ord 보존)이 ContentEditor 의 useState 클로저에 갇혀 DB+렌더+fetch 목 없이는
// 단위 테스트 불가였다. 결정을 순수 함수로 내면 DB/React 없이 핀되고, 훅(use-question-draft·
// use-concept-draft)이 이를 조립한다. 낙관적 병합은 저장 봉투 SSOT(toQuestionSlot·content-localize)를
// 재사용한다 — 그동안 ContentEditor 가 인라인 재구현(파생 topicId 누락 위험)하던 것을 없앤다.

// ── 식별자·순서 ──────────────────────────────────────────────
/** 새 문항 PK — 최대 qn + 1(빈 목록이면 1). */
export function nextQn(items: LocalizedQuestion[]): number {
  return items.reduce((m, q) => Math.max(m, q.qn), 0) + 1;
}

/** 개념 위치 — 기존은 현재 index(서버가 ord 보존), 신규(미존재)는 끝. */
export function ordFor(items: LocalizedConcept[], svc: string): number {
  const idx = items.findIndex((c) => c.svc === svc);
  return idx >= 0 ? idx : items.length;
}

// ── 낙관적 병합 (저장 성공 후 로컬 items 갱신) ────────────────────
// editLang 슬롯만 toQuestionSlot(SSOT)으로 채우고 다른 언어 슬롯은 보존한다(서버 upsert 의
// content || excluded 와 정합). qn 오름차순 정렬.
export function mergeQuestion(
  items: LocalizedQuestion[],
  draft: Question,
  lang: string,
): LocalizedQuestion[] {
  const existing = items.find((i) => i.qn === draft.qn);
  const merged: LocalizedQuestion = {
    qn: draft.qn,
    answer: draft.answer,
    content: { ...(existing?.content ?? {}), [lang]: toQuestionSlot(draft) },
  };
  return [...items.filter((i) => i.qn !== draft.qn), merged].sort((a, b) => a.qn - b.qn);
}

// 개념은 ord 위치에 삽입 — 기존은 위치 보존, 신규는 끝(ordFor 가 계산). 다른 언어 슬롯 보존.
export function mergeConcept(
  items: LocalizedConcept[],
  draft: Concept,
  lang: string,
  ord: number,
): LocalizedConcept[] {
  const existing = items.find((c) => c.svc === draft.svc);
  const merged: LocalizedConcept = {
    svc: draft.svc,
    content: { ...(existing?.content ?? {}), [lang]: toConceptSlot(draft) },
  };
  const rest = items.filter((c) => c.svc !== draft.svc);
  rest.splice(ord, 0, merged);
  return rest;
}

export function removeQuestion(items: LocalizedQuestion[], qn: number): LocalizedQuestion[] {
  return items.filter((i) => i.qn !== qn);
}

export function removeConcept(items: LocalizedConcept[], svc: string): LocalizedConcept[] {
  return items.filter((c) => c.svc !== svc);
}

// ── 질문 draft 변환 (옵션/정답 상태기계, 순수) ────────────────────
export function setOptionValue(d: Question, k: string, v: string): Question {
  return { ...d, options: { ...d.options, [k]: v } };
}

/** 다음 보기 글자(A,B,C…)를 빈 값으로 추가. */
export function addOption(d: Question): Question {
  const next = String.fromCharCode(65 + Object.keys(d.options).length);
  return { ...d, options: { ...d.options, [next]: "" } };
}

/** 보기 제거 + 정답에서도 prune(정답 ⊂ options 불변식 유지). */
export function removeOption(d: Question, k: string): Question {
  const { [k]: _drop, ...rest } = d.options;
  return { ...d, options: rest, answer: d.answer.filter((a) => a !== k) };
}

/** 정답 토글(있으면 제거, 없으면 추가). */
export function toggleAnswer(d: Question, k: string): Question {
  return {
    ...d,
    answer: d.answer.includes(k) ? d.answer.filter((a) => a !== k) : [...d.answer, k],
  };
}
