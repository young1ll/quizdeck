import fs from "node:fs";
import path from "node:path";
import type {
  Concept,
  Diagram,
  ExamData,
  ExamMeta,
  ExamSummary,
  Question,
} from "./types";

// 빌드 시점에 repo 루트의 content/ 를 읽는다. (정적 익스포트라 런타임 fs 접근 없음)
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
        questionCount: meta.counts?.questions ?? 0,
      });
    }
  }
  return out.sort((a, b) => a.code.localeCompare(b.code));
}

/** 특정 시험의 전체 데이터 로드 (빌드 시점에 해당 시험 폴더 전체를 읽음) */
export function loadExam(provider: string, slug: string): ExamData {
  const dir = path.join(CONTENT_ROOT, provider, slug);
  const meta = readJSON<ExamMeta>(path.join(dir, "meta.json"));
  const questions = readJSON<Question[]>(path.join(dir, "questions.json"));
  const concepts = readJSON<Concept[]>(path.join(dir, "concepts.json"));
  const diagrams = readJSON<Diagram[]>(path.join(dir, "diagrams.json"));
  const q2svc = readJSON<Record<string, string[]>>(path.join(dir, "q2svc.json"));
  const icons = readJSON<Record<string, string>>(path.join(dir, "icons.json"));
  return { meta, questions, concepts, diagrams, q2svc, icons };
}
