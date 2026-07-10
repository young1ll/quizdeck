import type { Pool } from "pg";
import type { Collection, CollectionItem } from "./collection";

// 컬렉션 CRUD (ADR-0022). 서버 전용(pg), annotation-db 패턴 계승 — learner_id 는 호출부(API)가
// 세션에서 해석해 넘기고 모든 쿼리를 (learner_id) 로 스코프한다. id 는 client 생성(uuid).

interface Row {
  id: string;
  name: string;
  items: CollectionItem[];
  updated_at: Date;
}

export async function listCollections(pool: Pool, learnerId: string): Promise<Collection[]> {
  const r = await pool.query<Row>(
    `select "id","name","items","updated_at"
       from "collection" where "learner_id" = $1
      order by "updated_at" desc`,
    [learnerId],
  );
  return r.rows.map((row) => ({
    id: row.id,
    name: row.name,
    items: row.items,
    updatedAt: row.updated_at.getTime(),
  }));
}

// upsert — id 충돌 시 **기존 행이 같은 learner 일 때만** 갱신(WHERE 가드, annotation-db 와 동일).
// client 가 타인 id 를 보내도 그 행을 덮어쓰지 못한다(insert 는 conflict 로 막히고 update 는 no-op).
export async function upsertCollection(
  pool: Pool,
  learnerId: string,
  c: Collection,
): Promise<void> {
  await pool.query(
    `insert into "collection" ("id","learner_id","name","items","updated_at")
          values ($1, $2, $3, $4::jsonb, now())
     on conflict ("id") do update
            set "name" = excluded."name",
                "items" = excluded."items",
                "updated_at" = now()
          where "collection"."learner_id" = $2`,
    [c.id, learnerId, c.name, JSON.stringify(c.items)],
  );
}

/** 단건 조회 — 상세 페이지(RSC)용. learner 스코프라 타인 id 는 null. */
export async function getCollection(
  pool: Pool,
  learnerId: string,
  id: string,
): Promise<Collection | null> {
  const r = await pool.query<Row>(
    `select "id","name","items","updated_at"
       from "collection" where "learner_id" = $1 and "id" = $2`,
    [learnerId, id],
  );
  const row = r.rows[0];
  if (!row) return null;
  return { id: row.id, name: row.name, items: row.items, updatedAt: row.updated_at.getTime() };
}

export async function deleteCollection(pool: Pool, learnerId: string, id: string): Promise<void> {
  await pool.query(`delete from "collection" where "learner_id" = $1 and "id" = $2`, [
    learnerId,
    id,
  ]);
}
