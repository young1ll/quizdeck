import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import { emptyProgress, recordResult } from "./progress";
import { postgresProgressStore } from "./progress-store-postgres";

// progress 테이블에 대한 실 postgres 검증 (이슈 #7 AC). DATABASE_URL 없으면 skip —
// 무DB CI 는 그대로 그린. 로컬/통합은 docker postgres + db/migrations 적용 후:
//   DATABASE_URL=postgres://quizdeck:quizdeck@localhost:55432/quizdeck pnpm test

const hasDb = Boolean(process.env.DATABASE_URL);
const NOW = Date.parse("2026-06-23T10:00:00Z");

describe.skipIf(!hasDb)("postgresProgressStore (실제 postgres 필요)", () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const suffix = `${Date.now()}`;
  const learnerId = `pg_learner_${suffix}`;
  const otherId = `pg_other_${suffix}`;

  beforeAll(async () => {
    // progress.learner_id 는 user(id) 를 FK 참조한다 — 먼저 Learner 행이 있어야 한다.
    for (const id of [learnerId, otherId]) {
      await pool.query(
        'insert into "user" ("id","name","email","emailVerified") values ($1,$2,$3,$4)',
        [id, "테스트", `${id}@example.com`, false],
      );
    }
  });

  afterAll(async () => {
    // on delete cascade 로 progress 행도 함께 삭제된다.
    await pool.query('delete from "user" where "id" = any($1)', [[learnerId, otherId]]);
    await pool.end();
  });

  it("없는 (learner, exam) 는 null", async () => {
    const store = postgresProgressStore(pool, learnerId);
    expect(await store.load("aws/none")).toBeNull();
  });

  it("save→load 봉투 round-trip (updatedAt ms 보존)", async () => {
    const store = postgresProgressStore(pool, learnerId);
    const snap = recordResult(emptyProgress(), 7, ["B"], false, NOW);
    const at = Date.parse("2026-06-23T11:30:00.123Z");

    await store.save("aws/sap-c02", snap, at);
    const got = await store.load("aws/sap-c02");

    expect(got?.snapshot).toEqual(snap);
    expect(got?.updatedAt).toBe(at);
  });

  it("upsert — 재저장이 같은 (learner, exam) 한 행을 덮어쓴다", async () => {
    const store = postgresProgressStore(pool, learnerId);
    await store.save("aws/up", emptyProgress(), 1000);
    const snap2 = recordResult(emptyProgress(), 1, ["A"], true, NOW);
    await store.save("aws/up", snap2, 2000);

    const got = await store.load("aws/up");
    expect(got?.updatedAt).toBe(2000);
    expect(got?.snapshot).toEqual(snap2);

    const cnt = await pool.query<{ n: number }>(
      'select count(*)::int as n from "progress" where "learner_id"=$1 and "exam_key"=$2',
      [learnerId, "aws/up"],
    );
    expect(cnt.rows[0].n).toBe(1);
  });

  it("learner 스코프 — 다른 learner_id 로는 보이지 않는다 (구조적 차단)", async () => {
    const mine = postgresProgressStore(pool, learnerId);
    const theirs = postgresProgressStore(pool, otherId);
    await mine.save("aws/scope", recordResult(emptyProgress(), 3, ["A"], true, NOW), 5000);
    expect(await theirs.load("aws/scope")).toBeNull();
  });
});
