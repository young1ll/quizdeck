-- 회원 탈퇴 cascade 보강 (이슈 #36 / ADR-0006). annotation(0005)에 learner_id FK 가 빠져 있어
-- user 삭제 시 주석이 고아로 남는다. user(id) on delete cascade 로 묶어, 탈퇴 시 Progress(0002,
-- 이미 cascade)·session·account 와 함께 주석도 선언적으로 정리되게 한다 — 앱 코드가 정리를 빠뜨릴
-- 수 없다(ADR-0006 결정 3).
-- (기존 annotation 행의 learner_id 는 세션 learner_id 로만 생성되어 모두 유효 → FK 추가 성공.)
alter table "annotation"
  add constraint "annotation_learner_id_fkey"
  foreign key ("learner_id") references "user" ("id") on delete cascade;
