import type { Pool } from "pg";
import type { Progress } from "./progress";

// 한 Learner 의 **모든 Exam** Progress 적재 (이슈 #37 / ADR-0006 결정 5). /me 서버 컴포넌트가
// 대시보드 집계에 직접 쓴다(content.ts 가 RSC 에서 DB 읽듯) — 새 API 엔드포인트 없음. per-exam
// postgresProgressStore 와 같은 progress 테이블·learner 스코프·봉투 매핑. DB 는 동기화된 Progress
// 의 소스라 기기 간 정합(막 만든 미동기 로컬 변경은 동기화 후 반영).
export interface AllProgressRow {
  examKey: string;
  snapshot: Progress;
  updatedAt: number;
}

export async function loadAllProgress(pool: Pool, learnerId: string): Promise<AllProgressRow[]> {
  const r = await pool.query<{ exam_key: string; snapshot: Progress; updated_at_ms: string }>(
    `select "exam_key",
            "snapshot",
            round(extract(epoch from "updated_at") * 1000)::bigint as updated_at_ms
       from "progress"
      where "learner_id" = $1
      order by "updated_at" desc`,
    [learnerId],
  );
  // jsonb 는 node-pg 가 객체로 파싱. bigint 는 문자열로 오므로 Number 환원(per-exam store 와 동일).
  return r.rows.map((row) => ({
    examKey: row.exam_key,
    snapshot: row.snapshot,
    updatedAt: Number(row.updated_at_ms),
  }));
}
