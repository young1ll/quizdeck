import fs from "node:fs";
import path from "node:path";
import type { Diagram, ExamMeta, ExamSummary } from "./types";
import { pool } from "./db";
import { loadConceptsLocalized, loadQuestionsLocalized } from "./content-db";
import { availableLangs, type LocalizedExamData } from "./content-localize";

// 콘텐츠 로더 (하이브리드 — ADR-0005 A). Question·Concept 은 DB, 나머지(diagrams·q2svc·icons·
// meta)는 repo 의 content/ 파일. 카탈로그(listExams)는 파일 meta 라 빌드-세이프(DB 불요).
const CONTENT_ROOT = path.join(process.cwd(), "content");

function readJSON<T>(p: string): T {
  return JSON.parse(fs.readFileSync(p, "utf-8")) as T;
}

/** content/<provider>/<slug>/ 디렉토리들을 순회해 meta.json 목록을 만든다 */
export function listExams(): ExamSummary[] {
  const out: ExamSummary[] = [];
  if (!fs.existsSync(CONTENT_ROOT)) return out;

  for (const provider of fs.readdirSync(CONTENT_ROOT)) {
    const providerDir = path.join(CONTENT_ROOT, provider);
    if (!fs.statSync(providerDir).isDirectory()) continue;

    for (const slug of fs.readdirSync(providerDir)) {
      const examDir = path.join(providerDir, slug);
      const metaPath = path.join(examDir, "meta.json");
      if (!fs.existsSync(metaPath)) continue;

      const meta = readJSON<ExamMeta>(metaPath);
      out.push({
        provider,
        providerName: meta.providerName ?? provider,
        slug,
        code: meta.code,
        name: meta.name,
        icon: meta.icon,
        track: meta.track,
        questionCount: meta.counts?.questions ?? 0,
      });
    }
  }
  return out.sort((a, b) => a.code.localeCompare(b.code));
}

/**
 * 한 시험의 전체 데이터 로드(양 언어). Question·Concept 은 DB 에서 **모든 언어 슬롯**을 그대로
 * 가져오고(클라이언트가 현재 언어로 투영·토글, #28), 나머지(diagrams·q2svc·icons·meta)는 파일.
 * meta.json 이 없으면(=알 수 없는 경로) null — 호출부가 notFound 한다.
 * 런타임(요청/ISR 재검증) 시 DB 를 읽으므로 async·서버 전용. (DB seed 절차: db/migrations/README.md)
 */
export async function loadExamLocalized(
  provider: string,
  slug: string,
): Promise<LocalizedExamData | null> {
  const dir = path.join(CONTENT_ROOT, provider, slug);
  const metaPath = path.join(dir, "meta.json");
  if (!fs.existsSync(metaPath)) return null;

  const meta = readJSON<ExamMeta>(metaPath);
  const examKey = `${provider}/${slug}`;
  const [questions, concepts] = await Promise.all([
    loadQuestionsLocalized(pool, examKey),
    loadConceptsLocalized(pool, examKey),
  ]);
  const diagrams = readJSON<Diagram[]>(path.join(dir, "diagrams.json"));
  const q2svc = readJSON<Record<string, string[]>>(path.join(dir, "q2svc.json"));
  const icons = readJSON<Record<string, string>>(path.join(dir, "icons.json"));
  // 가용 언어 = 콘텐츠 슬롯 합집합. 비어 있으면(시드 전) meta.language 로 폴백.
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
