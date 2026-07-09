-- 컬렉션 (ADR-0022). Learner 가 문항을 직접 담고 빼서 이름 붙이는 **큐레이션 세트** — 파생인
-- 내 문제함(ADR-0011)과 별개 개념. items 가 (examKey, qn) 참조라 **Exam 경계를 넘는다**(cross-Exam).
--
-- annotation(0005) 패턴 계승: id 는 client 생성(uuid) — 기기 간 같은 컬렉션을 CRUD 로 식별.
-- learner_id 는 항상 세션에서 해석하며 API 가 (learner_id) 스코프로 강제 → 타인 컬렉션 접근이
-- 구조적으로 차단. FK cascade 로 회원 탈퇴 시 함께 정리(0006 교훈 — 처음부터 FK).
create table "collection" (
  "id"         text primary key,
  "learner_id" text        not null references "user"("id") on delete cascade,
  "name"       text        not null,
  "items"      jsonb       not null default '[]'::jsonb, -- [{"examKey":"aws/saa-c03","qn":7}, …] 순서 보존
  "updated_at" timestamptz not null default now()
);

-- 목록 조회 = (learner_id) 스코프. 컬렉션은 학습자당 수십 개 수준의 저빈도 엔티티.
create index "collection_learner" on "collection" ("learner_id");
