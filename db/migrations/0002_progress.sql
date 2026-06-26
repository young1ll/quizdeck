-- Progress 동기화 저장소 (이슈 #7 / ADR-0003).
-- (Learner, Exam) 단위로 도메인 snapshot(jsonb)과 동기화 메타(updated_at)를 분리해 담는다 —
-- ProgressStore 봉투 StoredProgress{snapshot, updatedAt}(이슈 #5)와 정합.
-- PK(learner_id, exam_key): 한 Learner의 한 Exam당 한 행. learner_id 는 항상 세션에서
-- 해석되어(타인 키 접근을 구조적으로 차단) /api/progress 가 위임한다.
-- on delete cascade: user 삭제 시 그 Learner 의 Progress 도 함께 제거.
create table "progress" (
  "learner_id" text not null references "user" ("id") on delete cascade,
  "exam_key" text not null,
  "snapshot" jsonb not null,
  "updated_at" timestamptz not null,
  primary key ("learner_id", "exam_key")
);
