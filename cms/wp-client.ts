import type { ExamMeta, ExamSummary, ExamTrack } from "../lib/types.ts";
import {
  availableLangs,
  type ConceptSlot,
  type LocalizedExamData,
  type LocalizedQuestion,
  type QuestionSlot,
} from "../lib/content-localize.ts";

// WP REST 서빙 클라이언트 (ADR-0025 3단계) — 구 payload 투영과 같은 출력형을 WordPress 에서
// 재구성한다(이관 시점 diff 기계 검증 — 검증 스크립트는 4단계에서 폐기, 이력은 git·ADR-0025).
//  - 접근: 클러스터 내부 Service(WP_API_URL — k8s env) 기본, 미설정 시 tailnet 도메인(dev).
//  - published 만 보인다(익명 GET — WP 기본). 초안은 서빙에 존재하지 않는다.
//  - {}↔[] 동치: PHP 는 빈 연관배열을 못 표현 — object 계약 필드는 여기서 정규화한다.
//  - ko 단일(ADR-0025 결정 4): 봉투는 { ko: slot } 하나로 재구성 — 클라 투영·토글 로직 무변경.

const WP_API_URL = process.env.WP_API_URL || "https://wp.myquizdeck.com";

interface WpPost {
  id: number;
  qd: Record<string, unknown>;
}

async function wpGet(path: string): Promise<{ rows: WpPost[]; total: number }> {
  const res = await fetch(`${WP_API_URL}/wp-json/wp/v2${path}`, {
    headers: { Host: "wp.myquizdeck.com" }, // 내부 Service IP 접근 시에도 WP 라우팅 안정화
  });
  if (!res.ok) throw new Error(`WP GET ${path} → ${res.status}`);
  return {
    rows: (await res.json()) as WpPost[],
    total: Number(res.headers.get("X-WP-Total") ?? 0),
  };
}

async function wpGetAll(base: string): Promise<WpPost[]> {
  const out: WpPost[] = [];
  for (let page = 1; ; page++) {
    const { rows } = await wpGet(`${base}&per_page=100&page=${page}`);
    out.push(...rows);
    if (rows.length < 100) return out;
  }
}

/** PHP 빈 연관배열([]) → {} 정규화 — object 계약 필드 전용. */
function asRecord<T>(v: unknown): Record<string, T> {
  if (Array.isArray(v)) return {};
  return (v ?? {}) as Record<string, T>;
}

const und = <T>(v: T | null | undefined): T | undefined => (v === null || v === undefined ? undefined : v);

/** null/undefined 값 키 제거 — 구 봉투는 없는 필드를 키로 갖지 않는다(read.ts compact 와 동일). */
function compact<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== null && v !== undefined)) as T;
}

function toTrack(qd: Record<string, unknown>): ExamTrack | undefined {
  return qd.track_id ? { id: String(qd.track_id), name: String(qd.track_name ?? "") } : undefined;
}

export async function listExamsWp(): Promise<ExamSummary[]> {
  const exams = await wpGetAll("/qd-exams?");
  const out: ExamSummary[] = [];
  for (const e of exams) {
    const { total } = await wpGet(`/qd-questions?qd_exam=${e.id}&per_page=1`);
    out.push(
      compact({
        provider: String(e.qd.provider),
        providerName: String(e.qd.provider_name),
        slug: String(e.qd.slug),
        code: String(e.qd.code),
        name: String(e.qd.name),
        icon: und(e.qd.icon as string | null),
        track: toTrack(e.qd),
        questionCount: total,
      }) as ExamSummary,
    );
  }
  return out.sort((a, b) => a.code.localeCompare(b.code));
}

function questionEnvelope(w: WpPost): LocalizedQuestion {
  const qd = w.qd;
  const options: Record<string, string> = {};
  for (const row of (qd.options as Array<{ key: string; text: string }>) ?? []) options[row.key] = row.text;
  const slot = compact({
    topic: und(qd.topic as string | null),
    q: String(qd.q),
    options,
    explanation: und(qd.explanation as string | null),
    tip: und(qd.tip as string | null),
    image: und(qd.image as string | null),
    page: und(qd.page as number | null),
    deeplink: und(qd.deeplink as string | null),
  }) as QuestionSlot;
  return { qn: Number(qd.qn), answer: (qd.answer as string[]) ?? [], content: { ko: slot } };
}

function conceptEnvelope(w: WpPost): { svc: string; content: Record<string, ConceptSlot> } {
  const qd = w.qd;
  const slot = compact({
    cat: und(qd.cat as string | null),
    abbr: und(qd.abbr as string | null),
    deff: String(qd.deff),
    key: und(qd.key as string | null),
    when: und(qd.when as string | null),
    trap: und(qd.trap as string | null),
    vs: und(qd.vs as string | null),
    detail: und(qd.detail as string | null),
    cost: und(qd.cost as string | null),
    rel: und(qd.rel as number[] | null),
    reln: und(qd.reln as number | null),
  }) as ConceptSlot;
  return { svc: String(qd.svc), content: { ko: slot } };
}

async function findExamByKey(examKey: string): Promise<WpPost | null> {
  const { rows } = await wpGet(`/qd-exams?qd_exam_key=${encodeURIComponent(examKey)}&per_page=1`);
  return rows[0] ?? null;
}

export async function loadExamLocalizedWp(provider: string, slug: string): Promise<LocalizedExamData | null> {
  const exam = await findExamByKey(`${provider}/${slug}`);
  if (!exam) return null;

  const [questions, concepts] = await Promise.all([
    wpGetAll(`/qd-questions?qd_exam=${exam.id}&qd_orderby=num`),
    wpGetAll(`/qd-concepts?qd_exam=${exam.id}&qd_orderby=num`),
  ]);

  const qs = questions.map(questionEnvelope);
  const cs = concepts.map(conceptEnvelope);
  const diagrams = (exam.qd.diagrams ?? []) as LocalizedExamData["diagrams"];
  const q2svc = asRecord<string[]>(exam.qd.q2svc);
  const icons = asRecord<string>(exam.qd.svc_icons);

  const meta: ExamMeta = compact({
    provider: String(exam.qd.provider),
    providerName: String(exam.qd.provider_name),
    code: String(exam.qd.code),
    name: String(exam.qd.name),
    slug: String(exam.qd.slug),
    language: String(exam.qd.language ?? "ko"),
    icon: und(exam.qd.icon as string | null),
    track: toTrack(exam.qd),
    counts: { questions: qs.length, concepts: cs.length, diagrams: diagrams.length },
  }) as ExamMeta;

  const langs = availableLangs([...qs, ...cs]);
  return { meta, questions: qs, concepts: cs, diagrams, q2svc, icons, availableLangs: langs.length ? langs : [meta.language] };
}

export async function loadQuestionsByKeysWp(
  items: { examKey: string; qn: number }[],
): Promise<{ examKey: string; qn: number; answer: string[]; content: LocalizedQuestion["content"] }[]> {
  if (!items.length) return [];
  const byExam = new Map<string, number[]>();
  for (const it of items) byExam.set(it.examKey, [...(byExam.get(it.examKey) ?? []), it.qn]);

  const out: { examKey: string; qn: number; answer: string[]; content: LocalizedQuestion["content"] }[] = [];
  for (const [examKey, qns] of byExam) {
    const exam = await findExamByKey(examKey);
    if (!exam) continue;
    const rows = await wpGetAll(`/qd-questions?qd_exam=${exam.id}&qd_qn_in=${qns.join(",")}`);
    for (const w of rows) {
      const env = questionEnvelope(w);
      out.push({ examKey, qn: env.qn, answer: env.answer, content: env.content });
    }
  }
  return out;
}
