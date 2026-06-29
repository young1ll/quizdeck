import { describe, it, expect, afterAll } from "vitest";
import { pool } from "./db";

// 회원 탈퇴 시 Learner 데이터가 DB FK cascade 로 함께 정리됨을 실 postgres 로 증명한다
// (이슈 #36 AC / ADR-0006 결정 3 — Progress 는 0002, Annotation 은 0006 FK). DATABASE_URL
// 없으면 skip — 무DB CI 는 그대로 그린.
const hasDb = Boolean(process.env.DATABASE_URL);
const UID = `del_user_${Date.now()}`;

describe.skipIf(!hasDb)("회원 탈퇴 cascade (실 postgres + 0006 필요)", () => {
  afterAll(async () => {
    await pool.query(`delete from "user" where "id" = $1`, [UID]);
  });

  it("user 삭제 → 그 Learner 의 Progress·Annotation 이 FK cascade 로 함께 삭제된다", async () => {
    await pool.query(
      `insert into "user" ("id","name","email","emailVerified") values ($1,$2,$3,true)`,
      [UID, "Del", `${UID}@example.com`],
    );
    await pool.query(
      `insert into "progress" ("learner_id","exam_key","snapshot","updated_at")
        values ($1,'x/y','{}'::jsonb, now())`,
      [UID],
    );
    await pool.query(
      `insert into "annotation"
         ("id","learner_id","exam_key","qn","lang","field","kind","anchor")
        values ($1,$2,'x/y',1,'ko','q','highlight','{"quote":"q","prefix":"","suffix":""}'::jsonb)`,
      [`${UID}-a`, UID],
    );
    // 사전 조건 — 두 행 존재
    expect((await pool.query(`select 1 from "progress" where "learner_id"=$1`, [UID])).rowCount).toBe(1);
    expect((await pool.query(`select 1 from "annotation" where "learner_id"=$1`, [UID])).rowCount).toBe(1);

    await pool.query(`delete from "user" where "id" = $1`, [UID]);

    // cascade — 둘 다 사라짐
    expect((await pool.query(`select 1 from "progress" where "learner_id"=$1`, [UID])).rowCount).toBe(0);
    expect((await pool.query(`select 1 from "annotation" where "learner_id"=$1`, [UID])).rowCount).toBe(0);
  });
});
