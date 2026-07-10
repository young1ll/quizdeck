import fs from "node:fs";
import path from "node:path";
import { getPayload } from "payload";
import config from "../payload.config.ts";
import { pool } from "../lib/db.ts";
import type { Diagram, ExamMeta } from "../lib/types.ts";
import type { ConceptSlot, LocalizedQuestion, QuestionSlot } from "../lib/content-localize.ts";
import { loadQuestionsLocalized } from "../lib/content-db.ts";

// 구 소스(content/ 파일 + public 스키마) → Payload 전량 이관 (ADR-0024 2단계). **멱등** —
// examKey·(exam,qn)·(exam,svc) 로 upsert 하므로 재실행 안전. 구 소스는 읽기만 한다(서빙 무변경).
// 실행: DATABASE_URL=… PAYLOAD_SECRET=… pnpm payload run cms/migrate-content.ts
// 검증: 같은 env 로 cms/verify-content.ts (구 로더 출력 == 신 투영 출력 diff).
//
// 아이콘: exam_icon_override 는 현재 0행(2026-07-10 확인)이라 meta.icon 만 이관한다.
// 이미지 오버라이드 행이 발견되면 **중단**한다 — media 업로드(R2) 경로가 준비돼야 해서
// 사람이 결정할 일이지 조용히 건너뛸 일이 아니다.

const CONTENT_ROOT = path.join(process.cwd(), "content");

function readJSON<T>(p: string): T {
  return JSON.parse(fs.readFileSync(p, "utf-8")) as T;
}

/** 언어 무관 필드(page·deeplink)는 슬롯들에서 첫 값을 취한다 — 컬렉션 정의의 되돌림 규칙과 대칭. */
function firstNeutral<T>(lq: LocalizedQuestion, key: "page" | "deeplink"): T | undefined {
  for (const slot of Object.values(lq.content)) {
    const v = (slot as Record<string, unknown>)[key];
    if (v !== undefined && v !== null) return v as T;
  }
  return undefined;
}

function questionData(slot: QuestionSlot) {
  return {
    topic: slot.topic ?? null,
    q: slot.q,
    explanation: slot.explanation ?? null,
    tip: slot.tip ?? null,
  };
}

function conceptData(slot: ConceptSlot) {
  return {
    cat: slot.cat ?? null,
    abbr: slot.abbr ?? null,
    deff: slot.deff,
    key: slot.key ?? null,
    when: slot.when ?? null,
    trap: slot.trap ?? null,
    vs: slot.vs ?? null,
    detail: slot.detail ?? null,
    cost: slot.cost ?? null,
  };
}

/** ko 를 우선 primary 로 — meta.language 와 일치(현행 데이터는 ko 단일). */
function orderedLocales(content: Record<string, unknown>): string[] {
  return Object.keys(content).sort((a, b) => (a === "ko" ? -1 : b === "ko" ? 1 : 0));
}

const payload = await getPayload({ config });

// 이미지 아이콘 오버라이드 존재 시 중단(위 주석) — 이모지 오버라이드는 meta.icon 대신 채택한다.
const override = await pool.query<{ exam_key: string; icon: string | null; has_image: boolean }>(
  `select "exam_key", "icon", ("image" is not null) as has_image from "exam_icon_override"`,
);
const imageRows = override.rows.filter((r) => r.has_image);
if (imageRows.length) {
  throw new Error(
    `이미지 아이콘 오버라이드 ${imageRows.length}행 존재(${imageRows.map((r) => r.exam_key).join(", ")}) — media(R2) 이관 경로를 먼저 결정해야 한다`,
  );
}
const iconOverride = new Map(override.rows.map((r) => [r.exam_key, r.icon]));

let stats = { exams: 0, questions: 0, concepts: 0 };

for (const provider of fs.readdirSync(CONTENT_ROOT)) {
  const providerDir = path.join(CONTENT_ROOT, provider);
  if (!fs.statSync(providerDir).isDirectory()) continue;

  for (const slug of fs.readdirSync(providerDir)) {
    const dir = path.join(providerDir, slug);
    const metaPath = path.join(dir, "meta.json");
    if (!fs.existsSync(metaPath)) continue;

    const examKey = `${provider}/${slug}`;
    const meta = readJSON<ExamMeta>(metaPath);
    const diagrams = readJSON<Diagram[]>(path.join(dir, "diagrams.json"));
    const q2svc = readJSON<Record<string, string[]>>(path.join(dir, "q2svc.json"));
    const svcIcons = readJSON<Record<string, string>>(path.join(dir, "icons.json"));

    const examData = {
      provider,
      slug,
      providerName: meta.providerName ?? provider,
      code: meta.code,
      name: meta.name,
      language: meta.language as "ko" | "en",
      icon: iconOverride.get(examKey) ?? meta.icon ?? null,
      trackId: meta.track?.id ?? null,
      trackName: meta.track?.name ?? null,
      diagrams,
      q2svc,
      svcIcons,
    };

    const existing = await payload.find({
      collection: "exams",
      where: { examKey: { equals: examKey } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    });
    const examId = existing.docs[0]
      ? (await payload.update({ collection: "exams", id: existing.docs[0].id, data: examData, depth: 0 })).id
      : (await payload.create({ collection: "exams", data: examData, depth: 0 })).id;
    stats.exams++;

    // ── Questions (소스 = public.question — ADR-0005 이후 DB 가 진실) ──
    const questions = await loadQuestionsLocalized(pool, examKey);
    for (const lq of questions) {
      const locales = orderedLocales(lq.content);
      const primary = locales[0];
      const primarySlot = lq.content[primary];
      const base = {
        exam: examId,
        qn: lq.qn,
        answer: lq.answer,
        options: Object.entries(primarySlot.options).map(([key, text]) => ({ key, text })),
        page: firstNeutral<number>(lq, "page") ?? null,
        deeplink: firstNeutral<string>(lq, "deeplink") ?? null,
        ...questionData(primarySlot),
      };
      const found = await payload.find({
        collection: "questions",
        where: { and: [{ exam: { equals: examId } }, { qn: { equals: lq.qn } }] },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      });
      const doc = found.docs[0]
        ? await payload.update({ collection: "questions", id: found.docs[0].id, data: base, locale: primary as "ko", depth: 0 })
        : await payload.create({ collection: "questions", data: base, locale: primary as "ko", depth: 0 });
      // 추가 로케일 — 배열 행 id 를 유지한 채 localized 텍스트만 채운다(행 재생성 = 타 로케일 소실).
      for (const locale of locales.slice(1)) {
        const slot = lq.content[locale];
        await payload.update({
          collection: "questions",
          id: doc.id,
          locale: locale as "ko",
          depth: 0,
          data: {
            ...questionData(slot),
            options: (doc.options ?? []).map((row) => ({
              id: row.id,
              key: row.key,
              text: slot.options[row.key] ?? "",
            })),
          },
        });
      }
      stats.questions++;
    }

    // ── Concepts (ord 컬럼 포함 — 직접 조회, seed-content.mjs 의 SQL-중복 선례) ──
    const concepts = await pool.query<{ svc: string; ord: number; content: Record<string, ConceptSlot> }>(
      `select "svc", "ord", "content" from "concept" where "exam_key" = $1 order by "ord"`,
      [examKey],
    );
    for (const row of concepts.rows) {
      const locales = orderedLocales(row.content);
      const primary = locales[0];
      const primarySlot = row.content[primary];
      const base = {
        exam: examId,
        svc: row.svc,
        ord: row.ord,
        rel: (primarySlot.rel as number[] | undefined) ?? null,
        reln: (primarySlot.reln as number | undefined) ?? null,
        ...conceptData(primarySlot),
      };
      const found = await payload.find({
        collection: "concepts",
        where: { and: [{ exam: { equals: examId } }, { svc: { equals: row.svc } }] },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      });
      const doc = found.docs[0]
        ? await payload.update({ collection: "concepts", id: found.docs[0].id, data: base, locale: primary as "ko", depth: 0 })
        : await payload.create({ collection: "concepts", data: base, locale: primary as "ko", depth: 0 });
      for (const locale of locales.slice(1)) {
        await payload.update({
          collection: "concepts",
          id: doc.id,
          locale: locale as "ko",
          depth: 0,
          data: conceptData(row.content[locale]),
        });
      }
      stats.concepts++;
    }

    console.log(`migrated ${examKey}: ${questions.length} questions, ${concepts.rows.length} concepts`);
  }
}

console.log(`done: exams=${stats.exams} questions=${stats.questions} concepts=${stats.concepts}`);
process.exit(0);
