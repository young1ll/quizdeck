import type { Pool } from "pg";
import type { Concept, Question } from "./types";

// Question·Concept 의 DB 적재/조회 (이슈 #26 / ADR-0005 A). 서버 전용(pg).
// 언어 무관 식별/필드는 컬럼, 언어 의존 텍스트는 content jsonb 의 언어 슬롯. seed(db/seed-content.mjs)·
// 하이브리드 로더(lib/content.ts)·어드민(#27)이 이 함수들을 공유한다.

// 언어 슬롯 선택 — 요청 언어가 없으면 가용한 첫 언어로 폴백한다(변형 없음 → 빈 화면 방지, ADR-0005).
function pickLang<T>(content: Record<string, T>, lang: string): T | undefined {
  return content[lang] ?? Object.values(content)[0];
}

interface QuestionRow {
  qn: number;
  answer: string[];
  content: Record<string, Omit<Question, "qn" | "answer">>;
}

export async function loadQuestionsFromDb(
  pool: Pool,
  examKey: string,
  lang: string,
): Promise<Question[]> {
  const r = await pool.query<QuestionRow>(
    `select "qn", "answer", "content" from "question" where "exam_key" = $1 order by "qn"`,
    [examKey],
  );
  return r.rows.map((row) => {
    const slot = pickLang(row.content, lang) ?? ({} as Omit<Question, "qn" | "answer">);
    return { qn: row.qn, answer: row.answer, ...slot };
  });
}

interface ConceptRow {
  svc: string;
  content: Record<string, Omit<Concept, "svc">>;
}

export async function loadConceptsFromDb(
  pool: Pool,
  examKey: string,
  lang: string,
): Promise<Concept[]> {
  const r = await pool.query<ConceptRow>(
    `select "svc", "content" from "concept" where "exam_key" = $1 order by "ord"`,
    [examKey],
  );
  return r.rows.map((row) => {
    const slot = pickLang(row.content, lang) ?? ({} as Omit<Concept, "svc">);
    return { svc: row.svc, ...slot };
  });
}

// 한 항목당 한 행 upsert. 같은 행의 다른 언어 슬롯은 보존한다(`content || excluded.content` —
// jsonb 최상위 키 병합 → 해당 lang 슬롯만 추가/갱신). seed 와 어드민(#27)이 공용으로 쓴다.
export async function upsertQuestion(
  pool: Pool,
  examKey: string,
  q: Question,
  lang: string,
): Promise<void> {
  const { qn, answer, ...rest } = q;
  const content = { [lang]: rest };
  await pool.query(
    `insert into "question" ("exam_key", "qn", "answer", "content")
          values ($1, $2, $3, $4::jsonb)
     on conflict ("exam_key", "qn")
          do update set "answer" = excluded."answer",
                        "content" = "question"."content" || excluded."content"`,
    [examKey, qn, answer, JSON.stringify(content)],
  );
}

export async function upsertConcept(
  pool: Pool,
  examKey: string,
  c: Concept,
  lang: string,
  ord: number,
): Promise<void> {
  const { svc, ...rest } = c;
  const content = { [lang]: rest };
  await pool.query(
    `insert into "concept" ("exam_key", "svc", "ord", "content")
          values ($1, $2, $3, $4::jsonb)
     on conflict ("exam_key", "svc")
          do update set "ord" = excluded."ord",
                        "content" = "concept"."content" || excluded."content"`,
    [examKey, svc, ord, JSON.stringify(content)],
  );
}
