import type { Concept, Diagram, ExamMeta, Question } from "./types";

// 콘텐츠 언어 투영 (이슈 #28 / ADR-0005 C). client-safe(순수, no pg) — 서버 로더와 클라이언트
// (ExamApp 토글)가 공유한다. 같은 Question 의 언어 변형: qn·answer 는 언어 무관, q/options/
// explanation/tip/topic 만 언어별. content jsonb 의 언어 슬롯({en:{…}, ko:{…}})에서 골라낸다.

// 저장 슬롯(content jsonb 의 언어별 조각) 타입 — SSOT. 언어별 필드만 담는다:
//  - Question: 컬럼(qn·answer)과 **파생 topicId**(projectQuestion 이 canonical 에서 얹는 값, 비저장)를 제외.
//  - Concept: 컬럼(svc)을 제외.
// LocalizedQuestion.content 타입과 역방향 split(toQuestionSlot) 반환 타입이 이 한 정의를 공유한다.
export type QuestionSlot = Omit<Question, "qn" | "answer" | "topicId">;
export type ConceptSlot = Omit<Concept, "svc">;

export interface LocalizedQuestion {
  qn: number;
  answer: string[];
  content: Record<string, QuestionSlot>;
}

export interface LocalizedConcept {
  svc: string;
  content: Record<string, ConceptSlot>;
}

// 로더 출력 / ExamApp 입력 — 양 언어 콘텐츠 + 가용 언어. 클라이언트가 현재 언어로 투영한다.
export interface LocalizedExamData {
  meta: ExamMeta;
  questions: LocalizedQuestion[];
  concepts: LocalizedConcept[];
  diagrams: Diagram[];
  q2svc: Record<string, string[]>;
  icons: Record<string, string>;
  availableLangs: string[];
}

// 요청 언어 슬롯, 없으면 가용한 첫 슬롯으로 폴백 — 변형 없음 → 빈 화면 방지(AC).
function pickSlot<T>(content: Record<string, T>, lang: string): T | undefined {
  return content[lang] ?? Object.values(content)[0];
}

// canonicalLang(기본 = lang) 슬롯의 topic 을 **안정 topicId** 로 얹는다 — 그룹/필터/조인 키가 언어
// 토글에 불변이게(topic 은 지역화 라벨). 호출부(ExamProviders)가 meta.language 를 canonical 로 넘긴다.
export function projectQuestion(
  lq: LocalizedQuestion,
  lang: string,
  canonicalLang: string = lang,
): Question {
  const slot = pickSlot(lq.content, lang) ?? ({} as Omit<Question, "qn" | "answer">);
  const canonical = pickSlot(lq.content, canonicalLang) ?? slot;
  return { qn: lq.qn, answer: lq.answer, ...slot, topicId: canonical.topic ?? slot.topic };
}

export function projectConcept(lc: LocalizedConcept, lang: string): Concept {
  const slot = pickSlot(lc.content, lang) ?? ({} as ConceptSlot);
  return { svc: lc.svc, ...slot };
}

// projectQuestion/projectConcept 의 역방향 — 도메인 객체를 저장 슬롯(content[lang])으로. 컬럼과
// **파생 필드**를 떨궈 언어별 필드만 남긴다(envelope 경계의 단일 정의). 순수라 DB 없이 테스트되고,
// content-db 의 upsert 가 이걸 써서 파생 topicId·미상 필드가 jsonb 슬롯에 새지 않는다(리뷰 content-envelope).
export function toQuestionSlot(q: Question): QuestionSlot {
  const { qn, answer, topicId, ...slot } = q; // 컬럼(qn·answer)·파생(topicId) 제외
  return slot;
}

export function toConceptSlot(c: Concept): ConceptSlot {
  const { svc, ...slot } = c; // 컬럼(svc) 제외 — Concept 엔 파생 필드 없음
  return slot;
}

/** 모든 항목의 content 슬롯 키 합집합 — 토글에 노출할 가용 언어(부분 번역도 합집합). */
export function availableLangs(items: { content: Record<string, unknown> }[]): string[] {
  const set = new Set<string>();
  for (const it of items) for (const k of Object.keys(it.content)) set.add(k);
  return [...set];
}

// 언어 표시 라벨 — LangToggle·ContentEditor 공용.
export const LANG_LABEL: Record<string, string> = { ko: "한국어", en: "English" };

// 어드민 편집용 — 폴백 없이 **그 언어 슬롯만**(없으면 빈 텍스트). 미번역을 드러내 채우게 한다.
// qn·answer(언어 무관)는 항상 보존한다. (이슈 #28 — 언어별 편집)
export function questionForLang(lq: LocalizedQuestion, lang: string): Question {
  const slot = lq.content[lang];
  if (slot) return { qn: lq.qn, answer: lq.answer, ...slot };
  // 미번역 슬롯 — 다른 언어의 보기 키를 빈 값으로 가져와 admin 이 텍스트만 채우게 한다(정답 ⊂
  // options 가 유지돼 저장이 막히지 않음). 다른 슬롯도 없으면(완전 신규) 보기 A 하나.
  const other = Object.values(lq.content)[0];
  const keys = other ? Object.keys(other.options) : ["A"];
  const options = Object.fromEntries(keys.map((k) => [k, ""]));
  return { qn: lq.qn, answer: lq.answer, topic: "", q: "", options };
}

export function conceptForLang(lc: LocalizedConcept, lang: string): Concept {
  const slot = lc.content[lang];
  return slot
    ? { svc: lc.svc, ...slot }
    : { svc: lc.svc, cat: "", deff: "", key: "", when: "", trap: "", vs: "" };
}
