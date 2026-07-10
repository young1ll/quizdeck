import type { Payload } from "payload";
import type { ExamMeta, ExamSummary, ExamTrack } from "../lib/types.ts";
import {
  availableLangs,
  type ConceptSlot,
  type LocalizedConcept,
  type LocalizedExamData,
  type LocalizedQuestion,
  type QuestionSlot,
} from "../lib/content-localize.ts";
import type { Concept, Exam, Question } from "../payload-types.ts";

// Payload → 기존 로더 출력형 투영 (ADR-0024 2단계). 구 로더(lib/content.ts — 파일+public 스키마)와
// **완전히 같은 형태**(ExamSummary[]·LocalizedExamData)를 Payload 에서 재구성한다 — 2단계에선
// 이관 정합성 diff(cms/verify-content.ts)의 "신 로더" 역할, 3단계에선 서빙 로더의 토대.
//
// 로케일 봉투 재구성 규칙: locale:'all' 조회는 localized 필드를 {ko:…, en:…} 맵으로 준다 —
// **필수 localized 필드(q·deff)의 키 집합 = 그 문서가 가진 슬롯 로케일**. 언어 무관 필드
// (page·deeplink·rel·reln)는 존재하는 모든 슬롯에 같은 값으로 되돌린다(컬렉션 정의 참고).

/** locale:'all' 조회에서 localized 필드는 로케일 맵이 된다 — 생성 타입(단일 로케일)을 재해석. */
type AllLocales<T> = Record<string, T>;

/** null/undefined 값 키 제거 — 구 슬롯은 없는 필드를 키 자체로 갖지 않는다(jsonb 원형 보존). */
function compact<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== null && v !== undefined),
  ) as T;
}

function toTrack(doc: Pick<Exam, "trackId" | "trackName">): ExamTrack | undefined {
  return doc.trackId ? { id: doc.trackId, name: doc.trackName ?? "" } : undefined;
}

/** listExams()(파일 카탈로그) + questionCount 의 Payload 등가 — code 정렬까지 동일. */
export async function listExamsFromPayload(payload: Payload): Promise<ExamSummary[]> {
  const { docs } = await payload.find({
    collection: "exams",
    pagination: false,
    depth: 0,
    overrideAccess: true,
  });
  const out: ExamSummary[] = [];
  for (const doc of docs) {
    const { totalDocs } = await payload.count({
      collection: "questions",
      where: { exam: { equals: doc.id } },
      overrideAccess: true,
    });
    out.push(
      compact({
        provider: doc.provider,
        providerName: doc.providerName,
        slug: doc.slug,
        code: doc.code,
        name: doc.name,
        icon: doc.icon ?? undefined,
        track: toTrack(doc),
        questionCount: totalDocs,
      }) as ExamSummary,
    );
  }
  return out.sort((a, b) => a.code.localeCompare(b.code));
}

/** locale:'all' 문서의 localized 필드 맵에서 특정 로케일 값을 꺼낸다(비-localized면 그대로). */
function pick<T>(v: T | AllLocales<T> | null | undefined, locale: string): T | undefined {
  if (v === null || v === undefined) return undefined;
  return (v as AllLocales<T>)[locale] as T | undefined;
}

function questionEnvelope(doc: Question): LocalizedQuestion {
  const qMap = doc.q as unknown as AllLocales<string>;
  const content: Record<string, QuestionSlot> = {};
  for (const locale of Object.keys(qMap)) {
    const options: Record<string, string> = {};
    for (const row of doc.options ?? []) {
      const text = pick(row.text as unknown, locale);
      if (typeof text === "string") options[row.key] = text;
    }
    content[locale] = compact({
      topic: pick(doc.topic as unknown, locale),
      q: qMap[locale],
      options,
      explanation: pick(doc.explanation as unknown, locale),
      tip: pick(doc.tip as unknown, locale),
      page: doc.page ?? undefined,
      deeplink: doc.deeplink ?? undefined,
    }) as QuestionSlot;
  }
  return { qn: doc.qn, answer: (doc.answer ?? []) as string[], content };
}

function conceptEnvelope(doc: Concept): LocalizedConcept {
  const deffMap = doc.deff as unknown as AllLocales<string>;
  const content: Record<string, ConceptSlot> = {};
  for (const locale of Object.keys(deffMap)) {
    content[locale] = compact({
      cat: pick(doc.cat as unknown, locale),
      abbr: pick(doc.abbr as unknown, locale),
      deff: deffMap[locale],
      key: pick(doc.key as unknown, locale),
      when: pick(doc.when as unknown, locale),
      trap: pick(doc.trap as unknown, locale),
      vs: pick(doc.vs as unknown, locale),
      detail: pick(doc.detail as unknown, locale),
      cost: pick(doc.cost as unknown, locale),
      rel: doc.rel ?? undefined,
      reln: doc.reln ?? undefined,
    }) as ConceptSlot;
  }
  return { svc: doc.svc, content };
}

/** loadExamLocalized()(파일 meta + public 스키마) 의 Payload 등가. 미존재 examKey 는 null. */
export async function loadExamLocalizedFromPayload(
  payload: Payload,
  provider: string,
  slug: string,
): Promise<LocalizedExamData | null> {
  const examKey = `${provider}/${slug}`;
  const found = await payload.find({
    collection: "exams",
    where: { examKey: { equals: examKey } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  const exam = found.docs[0];
  if (!exam) return null;

  const [qRes, cRes] = await Promise.all([
    payload.find({
      collection: "questions",
      where: { exam: { equals: exam.id } },
      locale: "all",
      sort: "qn",
      pagination: false,
      depth: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: "concepts",
      where: { exam: { equals: exam.id } },
      locale: "all",
      sort: "ord",
      pagination: false,
      depth: 0,
      overrideAccess: true,
    }),
  ]);

  const questions = qRes.docs.map(questionEnvelope);
  const concepts = cRes.docs.map(conceptEnvelope);
  const diagrams = (exam.diagrams ?? []) as LocalizedExamData["diagrams"];
  const q2svc = (exam.q2svc ?? {}) as Record<string, string[]>;
  const icons = (exam.svcIcons ?? {}) as Record<string, string>;

  const meta: ExamMeta = compact({
    provider: exam.provider,
    providerName: exam.providerName,
    code: exam.code,
    name: exam.name,
    slug: exam.slug,
    language: exam.language,
    icon: exam.icon ?? undefined,
    track: toTrack(exam),
    counts: { questions: questions.length, concepts: concepts.length, diagrams: diagrams.length },
  }) as ExamMeta;

  const langs = availableLangs([...questions, ...concepts]);
  return {
    meta,
    questions,
    concepts,
    diagrams,
    q2svc,
    icons,
    availableLangs: langs.length ? langs : [meta.language],
  };
}
