-- 인라인 주석 (이슈 #29 / ADR-0005 D). Learner 가 문제·해설·선택지 텍스트 구간에 다는 밑줄/형광펜
-- + 메모. Progress 처럼 사용자 데이터(seam=전용 /api/annotations) — 콘텐츠는 앵커(quote+문맥)로만
-- 참조하므로 본문이 바뀌어도 행은 보존(graceful orphan). 언어별(lang) 분리 — EN 주석은 KO 화면에 안 뜸.
--
-- id 는 client 생성(uuid) — 같은 주석을 기기 간 CRUD 로 식별. learner_id 는 항상 세션에서 해석하며
-- API 가 (learner_id) 스코프로 강제하므로 타인 주석 접근이 구조적으로 차단된다.
create table "annotation" (
  "id"         text primary key,
  "learner_id" text        not null,
  "exam_key"   text        not null,
  "qn"         integer     not null,
  "lang"       text        not null,
  "field"      text        not null,   -- 'q' | 'explanation' | 'tip' | 'opt:A' …
  "kind"       text        not null,   -- 'underline' | 'highlight'
  "memo"       text,
  "anchor"     jsonb       not null,   -- { quote, prefix, suffix } (TextQuoteSelector 류)
  "updated_at" timestamptz not null default now()
);

-- 목록 조회 = (learner_id, exam_key) 스코프. 한 시험 진입 시 그 Learner 의 주석 전부를 끌어온다.
create index "annotation_learner_exam" on "annotation" ("learner_id", "exam_key");
