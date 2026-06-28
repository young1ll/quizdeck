-- Question·Concept 콘텐츠를 DB로 (이슈 #26 / ADR-0005 A).
-- 콘텐츠를 런타임 편집(웹 어드민, #27)·동기화 가능한 단일 소스로 옮긴다. Exam 페이지는
-- 이 테이블을 ISR 로 읽는다(빌드타임 SSG 폐기). Diagram(SVG)·q2svc·icons·meta 는 파일 잔존.
--
-- 언어 무관 식별/필드는 컬럼, 언어 의존 텍스트는 content jsonb 의 언어 슬롯에 둔다 — 같은
-- 항목의 en/ko 변형(i18n #28)을 한 행에 담는다. exam_key 는 progress 와 같은 text 스코프
-- (FK 없음 — exam 메타는 파일).
--
--  question.content = { <lang>: { q, options, explanation, tip, topic, page, deeplink } }
--  concept.content  = { <lang>: { cat, abbr, deff, detail, key, when, trap, vs, cost, rel, reln } }
--
-- answer(정답 글자)는 언어 무관이고 어드민 검증(정답 ⊂ options, #27)에 쓰여 컬럼으로 둔다.
-- qn 은 Progress 조인 키(ADR-0001) — 마이그레이션이 보존한다.

create table "question" (
  "exam_key" text not null,
  "qn"       integer not null,
  "answer"   text[] not null,
  "content"  jsonb not null,
  primary key ("exam_key", "qn")
);

-- Concept 은 qn 같은 안정 id 가 없다 — 자연 식별자는 svc(서비스명). q2svc·개념 조회가 svc 로 매칭.
-- "ord" 는 저자 작성 순서(concepts.json 배열 인덱스) — 개념 목록 표시 순서를 파일과 동일하게
-- 보존한다(ORDER BY ord). question 은 qn 으로 정렬하므로 별도 순서 컬럼이 불필요하다.
create table "concept" (
  "exam_key" text not null,
  "svc"      text not null,
  "ord"      integer not null,
  "content"  jsonb not null,
  primary key ("exam_key", "svc")
);
