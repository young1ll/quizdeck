import type { Pool } from "pg";
import type { Concept, Question } from "./types";
import {
  projectConcept,
  projectQuestion,
  toConceptSlot,
  toQuestionSlot,
  type LocalizedConcept,
  type LocalizedQuestion,
} from "./content-localize";

// Question·Concept 의 DB 적재/조회 (이슈 #26 / ADR-0005 A·C). 서버 전용(pg).
// 언어 무관 식별/필드는 컬럼, 언어 의존 텍스트는 content jsonb 의 언어 슬롯. seed(db/seed-content.mjs)·
// 하이브리드 로더(lib/content.ts)·어드민(#27)이 이 함수들을 공유한다.

// localized: 양 언어 슬롯을 그대로 — 클라이언트 토글(#28)이 투영한다.
export async function loadQuestionsLocalized(
  pool: Pool,
  examKey: string,
): Promise<LocalizedQuestion[]> {
  const r = await pool.query<LocalizedQuestion>(
    `select "qn", "answer", "content" from "question" where "exam_key" = $1 order by "qn"`,
    [examKey],
  );
  return r.rows;
}

export async function loadConceptsLocalized(
  pool: Pool,
  examKey: string,
): Promise<LocalizedConcept[]> {
  const r = await pool.query<LocalizedConcept>(
    `select "svc", "content" from "concept" where "exam_key" = $1 order by "ord"`,
    [examKey],
  );
  return r.rows;
}

// 단일 언어 투영 — 서버에서 한 언어만 필요할 때(테스트 등). 토글은 localized 를 클라이언트가 투영.
export async function loadQuestionsFromDb(
  pool: Pool,
  examKey: string,
  lang: string,
): Promise<Question[]> {
  return (await loadQuestionsLocalized(pool, examKey)).map((lq) => projectQuestion(lq, lang));
}

export async function loadConceptsFromDb(
  pool: Pool,
  examKey: string,
  lang: string,
): Promise<Concept[]> {
  return (await loadConceptsLocalized(pool, examKey)).map((lc) => projectConcept(lc, lang));
}

// 한 항목당 한 행 upsert. 같은 행의 다른 언어 슬롯은 보존한다(`content || excluded.content` —
// jsonb 최상위 키 병합 → 해당 lang 슬롯만 추가/갱신). seed 와 어드민(#27)이 공용으로 쓴다.
export async function upsertQuestion(
  pool: Pool,
  examKey: string,
  q: Question,
  lang: string,
): Promise<void> {
  // 언어별 슬롯은 순수 역방향(toQuestionSlot)이 만든다 — 파생 topicId·미상 필드가 슬롯에 새지 않게.
  const content = { [lang]: toQuestionSlot(q) };
  await pool.query(
    `insert into "question" ("exam_key", "qn", "answer", "content")
          values ($1, $2, $3, $4::jsonb)
     on conflict ("exam_key", "qn")
          do update set "answer" = excluded."answer",
                        "content" = "question"."content" || excluded."content"`,
    [examKey, q.qn, q.answer, JSON.stringify(content)],
  );
}

// ord 는 INSERT 에서만 설정한다 — 기존 개념 편집(conflict)은 순서를 보존(어드민이 한 항목을
// 고쳐도 목록이 재배열되지 않음, #27). 초기 seed 는 파일 인덱스를 ord 로 넣는다.
export async function upsertConcept(
  pool: Pool,
  examKey: string,
  c: Concept,
  lang: string,
  ord: number,
): Promise<void> {
  const content = { [lang]: toConceptSlot(c) };
  await pool.query(
    `insert into "concept" ("exam_key", "svc", "ord", "content")
          values ($1, $2, $3, $4::jsonb)
     on conflict ("exam_key", "svc")
          do update set "content" = "concept"."content" || excluded."content"`,
    [examKey, c.svc, ord, JSON.stringify(content)],
  );
}

export async function deleteQuestion(pool: Pool, examKey: string, qn: number): Promise<void> {
  await pool.query(`delete from "question" where "exam_key" = $1 and "qn" = $2`, [examKey, qn]);
}

export async function deleteConcept(pool: Pool, examKey: string, svc: string): Promise<void> {
  await pool.query(`delete from "concept" where "exam_key" = $1 and "svc" = $2`, [examKey, svc]);
}
