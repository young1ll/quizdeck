import type { Pool } from "pg";
import type { Annotation, AnnotationKind } from "./annotation";

// admin 용 주석 조회/관리 (ADR-0027 — 소비처는 wp-admin '회원 주석' 화면의 서버-서버 호출).
// annotation-db.ts 와 의도적으로 분리 — 저쪽은 "모든 쿼리 learner_id 스코프(타인 접근 구조적 차단)"
// 불변식을 갖고, 여긴 그 스코프를 벗은 id/전회원 쿼리다. 인가는 호출부(withServiceToken)가
// 소유하므로 이 모듈을 admin API 경계 밖에서 import 하면 안 된다.

export interface LearnerAnnotationSummary {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  annotationCount: number;
  lastAnnotatedAt: number | null;
}

/** 회원 검색(이메일/이름 부분일치, q 빈 문자열 = 전체) + 주석 카운트. 주석 많은 순 상위 50. */
export async function searchLearnersWithAnnotations(
  pool: Pool,
  q: string,
): Promise<LearnerAnnotationSummary[]> {
  const r = await pool.query<{
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    count: number;
    last: Date | null;
  }>(
    `select u."id", u."name", u."email", u."emailVerified",
            count(a."id")::int as count, max(a."updated_at") as last
       from "user" u
       left join "annotation" a on a."learner_id" = u."id"
      where $1 = '' or u."email" ilike '%'||$1||'%' or u."name" ilike '%'||$1||'%'
      group by u."id"
      order by count(a."id") desc, u."createdAt" desc
      limit 50`,
    [q],
  );
  return r.rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    emailVerified: row.emailVerified,
    annotationCount: row.count,
    lastAnnotatedAt: row.last ? row.last.getTime() : null,
  }));
}

/** 상세 페이지 헤더용 회원 요약 — 없는 id 면 null(페이지가 notFound). */
export async function getLearnerSummary(
  pool: Pool,
  learnerId: string,
): Promise<{ id: string; name: string; email: string; emailVerified: boolean } | null> {
  const r = await pool.query<{
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
  }>(`select "id","name","email","emailVerified" from "user" where "id" = $1`, [learnerId]);
  return r.rows[0] ?? null;
}

export interface AdminAnnotationRow extends Annotation {
  examKey: string;
}

/** 회원 한 명의 주석 전부 — exam_key·qn·field 정렬(시험별 그룹핑은 호출부의 단순 reduce). */
export async function listAnnotationsByLearner(
  pool: Pool,
  learnerId: string,
): Promise<AdminAnnotationRow[]> {
  const r = await pool.query<{
    id: string;
    exam_key: string;
    qn: number;
    lang: string;
    field: string;
    kind: string;
    memo: string | null;
    anchor: Annotation["anchor"];
    updated_at: Date;
  }>(
    `select "id","exam_key","qn","lang","field","kind","memo","anchor","updated_at"
       from "annotation" where "learner_id" = $1
      order by "exam_key", "qn", "field"`,
    [learnerId],
  );
  return r.rows.map((row) => ({
    id: row.id,
    examKey: row.exam_key,
    qn: row.qn,
    lang: row.lang,
    field: row.field,
    kind: row.kind as AnnotationKind,
    memo: row.memo,
    anchor: row.anchor,
    updatedAt: row.updated_at.getTime(),
  }));
}

/** memo·kind 2컬럼만 갱신 — anchor/field/qn/lang/learner_id 는 SQL 에 등장하지 않아 구조적 불변.
 * 없는 id 면 false. */
export async function adminUpdateAnnotation(
  pool: Pool,
  id: string,
  patch: { memo: string | null; kind: AnnotationKind },
): Promise<boolean> {
  const r = await pool.query(
    `update "annotation" set "memo" = $2, "kind" = $3, "updated_at" = now() where "id" = $1`,
    [id, patch.memo, patch.kind],
  );
  return (r.rowCount ?? 0) > 0;
}

/** id 기준 삭제 — 없는 id 면 false. */
export async function adminDeleteAnnotation(pool: Pool, id: string): Promise<boolean> {
  const r = await pool.query(`delete from "annotation" where "id" = $1`, [id]);
  return (r.rowCount ?? 0) > 0;
}
