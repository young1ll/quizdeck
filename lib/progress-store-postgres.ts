import type { Pool } from "pg";
import type { Progress } from "./progress";
import type { ProgressStore } from "./progress-store";

// postgres ProgressStore (이슈 #7 / ADR-0003). DB VM 의 progress 테이블이 백엔드다.
//
// learnerId 는 생성 시 바인딩된다 — seam 의 key 는 exam_key 뿐이고 learner_id 는 절대
// client 가 정하지 못한다. /api/progress 가 세션에서 해석한 learner_id 로 이 store 를
// 만들어 위임하므로, 타인 (learner_id, exam_key) 접근이 구조적으로 차단된다.
//
// 봉투 ↔ 컬럼 매핑: snapshot(jsonb) / updated_at(timestamptz). 봉투의 updatedAt 은
// epoch ms(number) 라 to_timestamp 로 넣고 extract(epoch) 로 다시 ms 로 읽어 round-trip 한다.
export function postgresProgressStore(pool: Pool, learnerId: string): ProgressStore {
  return {
    async load(examKey) {
      const r = await pool.query<{ snapshot: Progress; updated_at_ms: string }>(
        `select "snapshot",
                round(extract(epoch from "updated_at") * 1000)::bigint as updated_at_ms
           from "progress"
          where "learner_id" = $1 and "exam_key" = $2`,
        [learnerId, examKey],
      );
      if (r.rowCount === 0) return null;
      const row = r.rows[0];
      // jsonb 는 node-pg 가 객체로 파싱한다. bigint 는 문자열로 오므로 Number 로 환원.
      return { snapshot: row.snapshot, updatedAt: Number(row.updated_at_ms) };
    },

    async save(examKey, snapshot, updatedAt) {
      await pool.query(
        `insert into "progress" ("learner_id", "exam_key", "snapshot", "updated_at")
              values ($1, $2, $3::jsonb, to_timestamp($4::double precision / 1000.0))
         on conflict ("learner_id", "exam_key")
              do update set "snapshot" = excluded."snapshot",
                            "updated_at" = excluded."updated_at"`,
        [learnerId, examKey, JSON.stringify(snapshot), updatedAt],
      );
    },
  } satisfies ProgressStore;
}
