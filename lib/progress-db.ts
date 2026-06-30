import type { Pool } from "pg";
import type { Progress } from "./progress";
import type { StoredProgress } from "./progress-store";

// progress 테이블 접근 모듈 (이슈 #7/#37 · ADR-0003/0006 · 리뷰 C5). progress 테이블의 봉투↔컬럼
// 계약을 **한 곳**에 둔다 — snapshot(jsonb) / updated_at(timestamptz). 봉투의 updatedAt 은 epoch ms
// 라 to_timestamp 로 넣고 extract(epoch) 로 다시 ms 로 읽어 round-trip 한다. 그동안 이 매핑이
// postgres-store(load/save)와 여기(loadAll) 두 곳에 중복돼 있었다 — 이제 loadOne/loadAll/save 가
// 같은 투영·매핑을 공유한다. learner_id 스코프는 호출부(route·/me)가 세션에서 해석해 넘긴다 —
// client 가 절대 못 정하므로 타인 (learner_id, exam_key) 접근이 구조적으로 차단된다.
//
// postgresProgressStore(progress-store-postgres)는 이 모듈을 ProgressStore seam 에 맞춘 얇은
// 어댑터이고, /me 서버 컴포넌트는 loadAllProgress 를 대시보드 집계에 직접 쓴다(새 API 없음).

// 모든 read 가 공유하는 SELECT 투영: jsonb snapshot + updated_at 을 epoch ms(bigint→문자열)로.
const SELECT_ENVELOPE = `"snapshot", round(extract(epoch from "updated_at") * 1000)::bigint as updated_at_ms`;

type EnvelopeRow = { snapshot: Progress; updated_at_ms: string };

// node-pg: jsonb 는 객체로 파싱하고 bigint 는 문자열로 오므로 Number 로 환원한다.
function toStored(row: EnvelopeRow): StoredProgress {
  return { snapshot: row.snapshot, updatedAt: Number(row.updated_at_ms) };
}

/** 한 (Learner, Exam) 의 봉투(없으면 null). postgresProgressStore.load 가 위임한다. */
export async function loadProgress(
  pool: Pool,
  learnerId: string,
  examKey: string,
): Promise<StoredProgress | null> {
  const r = await pool.query<EnvelopeRow>(
    `select ${SELECT_ENVELOPE}
       from "progress"
      where "learner_id" = $1 and "exam_key" = $2`,
    [learnerId, examKey],
  );
  return r.rowCount === 0 ? null : toStored(r.rows[0]);
}

/** 한 (Learner, Exam) 봉투를 upsert. postgresProgressStore.save 가 위임한다. */
export async function saveProgress(
  pool: Pool,
  learnerId: string,
  examKey: string,
  snapshot: Progress,
  updatedAt: number,
): Promise<void> {
  await pool.query(
    `insert into "progress" ("learner_id", "exam_key", "snapshot", "updated_at")
          values ($1, $2, $3::jsonb, to_timestamp($4::double precision / 1000.0))
     on conflict ("learner_id", "exam_key")
          do update set "snapshot" = excluded."snapshot",
                        "updated_at" = excluded."updated_at"`,
    [learnerId, examKey, JSON.stringify(snapshot), updatedAt],
  );
}

export interface AllProgressRow {
  examKey: string;
  snapshot: Progress;
  updatedAt: number;
}

/** 한 Learner 의 **모든 Exam** 봉투(/me 대시보드 집계용). updated_at 내림차순. */
export async function loadAllProgress(pool: Pool, learnerId: string): Promise<AllProgressRow[]> {
  const r = await pool.query<EnvelopeRow & { exam_key: string }>(
    `select "exam_key", ${SELECT_ENVELOPE}
       from "progress"
      where "learner_id" = $1
      order by "updated_at" desc`,
    [learnerId],
  );
  return r.rows.map((row) => ({ examKey: row.exam_key, ...toStored(row) }));
}
