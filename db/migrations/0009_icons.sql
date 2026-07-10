-- 아이콘 (ADR-0023). 두 가지:
--
-- 1) collection.icon — 컬렉션은 Learner 소유 엔티티(0008)라 컬럼 추가로 끝. NULL = 아이콘 없음.
--
-- 2) exam_icon_override — 문제집(Exam) 카탈로그는 파일(meta.json) 소유·빌드-세이프(ADR-0005 A)인데,
--    admin 이 런타임에 아이콘을 수정할 수 있어야 한다(재배포 없이). 카탈로그 자체를 DB 로 옮기지
--    않고 **아이콘만 오버라이드**하는 최소 오버레이 — 행 존재 = 오버라이드, 행 삭제 = 파일 기본값
--    복귀. exam_key 는 progress·question 과 같은 text 스코프(FK 없음 — exam 메타는 파일).
alter table "collection" add column "icon" text;

create table "exam_icon_override" (
  "exam_key"   text primary key,
  "icon"       text        not null,
  "updated_at" timestamptz not null default now()
);
