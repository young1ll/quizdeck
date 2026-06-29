import type { Pool } from "pg";
import type { Annotation, AnnotationKind } from "./annotation";

// 주석 CRUD (이슈 #29 / ADR-0005 D). 서버 전용(pg). learner_id 는 호출부(API)가 세션에서 해석해
// 넘기며 모든 쿼리를 (learner_id) 로 스코프한다 — client 는 learner_id 를 정하지 못하므로 타인 주석
// 접근이 구조적으로 차단된다. id 는 client 생성(uuid) — 같은 주석을 기기 간 CRUD 로 식별.

interface Row {
  id: string;
  qn: number;
  lang: string;
  field: string;
  kind: string;
  memo: string | null;
  anchor: Annotation["anchor"];
  updated_at: Date;
}

export async function listAnnotations(
  pool: Pool,
  learnerId: string,
  examKey: string,
): Promise<Annotation[]> {
  const r = await pool.query<Row>(
    `select "id","qn","lang","field","kind","memo","anchor","updated_at"
       from "annotation" where "learner_id" = $1 and "exam_key" = $2`,
    [learnerId, examKey],
  );
  return r.rows.map((row) => ({
    id: row.id,
    qn: row.qn,
    lang: row.lang,
    field: row.field,
    kind: row.kind as AnnotationKind,
    memo: row.memo,
    anchor: row.anchor,
    updatedAt: row.updated_at.getTime(),
  }));
}

// upsert — id 충돌 시 **기존 행이 같은 learner 일 때만** 갱신한다(WHERE 가드). client 가 타인 id 를
// 보내도 그 행을 덮어쓰지 못한다(insert 는 conflict 로 막히고, update 는 WHERE 불일치 → no-op).
export async function upsertAnnotation(
  pool: Pool,
  learnerId: string,
  examKey: string,
  a: Annotation,
): Promise<void> {
  await pool.query(
    `insert into "annotation"
        ("id","learner_id","exam_key","qn","lang","field","kind","memo","anchor","updated_at")
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb, now())
      on conflict ("id") do update set
        "qn" = excluded."qn", "lang" = excluded."lang", "field" = excluded."field",
        "kind" = excluded."kind", "memo" = excluded."memo", "anchor" = excluded."anchor",
        "updated_at" = now()
      where "annotation"."learner_id" = excluded."learner_id"`,
    [
      a.id,
      learnerId,
      examKey,
      a.qn,
      a.lang,
      a.field,
      a.kind,
      a.memo ?? null,
      JSON.stringify(a.anchor),
    ],
  );
}

export async function deleteAnnotation(
  pool: Pool,
  learnerId: string,
  id: string,
): Promise<void> {
  await pool.query(`delete from "annotation" where "id" = $1 and "learner_id" = $2`, [
    id,
    learnerId,
  ]);
}
