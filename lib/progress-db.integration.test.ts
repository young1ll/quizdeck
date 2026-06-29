import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { pool } from "./db";
import { loadAllProgress } from "./progress-db";
import { emptyProgress, recordResult } from "./progress";

// loadAllProgress 의 learner 스코프·전 Exam 적재를 실 postgres 로 검증한다 (이슈 #37). DATABASE_URL
// 없으면 skip — 무DB CI 는 그대로 그린.
const hasDb = Boolean(process.env.DATABASE_URL);
const UID = `dash_learner_${Date.now()}`;

describe.skipIf(!hasDb)("loadAllProgress (실 postgres 필요)", () => {
  beforeAll(async () => {
    // progress.learner_id 는 user(id) FK — user 행 선생성.
    await pool.query(`delete from "user" where "id" = $1`, [UID]);
    await pool.query(
      `insert into "user" ("id","name","email","emailVerified") values ($1,'D',$2,true)`,
      [UID, `${UID}@example.com`],
    );
    const a = recordResult(emptyProgress(), 1, ["A"], true, Date.parse("2026-06-28T00:00:00Z"));
    const rows: [string, ReturnType<typeof emptyProgress>, number][] = [
      ["aws/a", a, 1000],
      ["aws/b", emptyProgress(), 2000],
    ];
    for (const [exam, snap, ts] of rows) {
      await pool.query(
        `insert into "progress" ("learner_id","exam_key","snapshot","updated_at")
          values ($1,$2,$3::jsonb, to_timestamp($4::double precision / 1000.0))`,
        [UID, exam, JSON.stringify(snap), ts],
      );
    }
  });
  afterAll(async () => {
    await pool.query(`delete from "user" where "id" = $1`, [UID]);
  });

  it("그 Learner 의 모든 Exam Progress 를 봉투로 돌려준다", async () => {
    const all = await loadAllProgress(pool, UID);
    expect(all.map((r) => r.examKey).sort()).toEqual(["aws/a", "aws/b"]);
    const a = all.find((r) => r.examKey === "aws/a")!;
    expect(Object.keys(a.snapshot.hist)).toEqual(["1"]); // 1번 문항 학습 이력
    expect(a.updatedAt).toBe(1000); // updatedAt round-trip
  });

  it("다른 Learner 의 Progress 는 섞이지 않는다", async () => {
    expect(await loadAllProgress(pool, "nobody-xyz")).toEqual([]);
  });
});
