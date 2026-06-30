import type { Pool } from "pg";
import type { ProgressStore } from "./progress-store";
import { loadProgress, saveProgress } from "./progress-db";

// postgres ProgressStore (이슈 #7 / ADR-0003 · 리뷰 C5). progress-db 의 테이블 접근을 ProgressStore
// seam 에 맞춘 **얇은 어댑터** — learnerId 를 바인딩하고 exam_key 만 seam 키로 노출한다. 봉투↔컬럼
// 매핑은 progress-db 가 소유한다(그동안 여기에 중복돼 있었다). /api/progress 가 세션에서 해석한
// learner_id 로 이 store 를 만들어 위임하므로, 타인 (learner_id, exam_key) 접근이 구조적으로 차단된다.
export function postgresProgressStore(pool: Pool, learnerId: string): ProgressStore {
  return {
    load: (examKey) => loadProgress(pool, learnerId, examKey),
    save: (examKey, snapshot, updatedAt) =>
      saveProgress(pool, learnerId, examKey, snapshot, updatedAt),
  } satisfies ProgressStore;
}
