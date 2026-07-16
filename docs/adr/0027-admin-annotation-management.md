# 0027 — 회원 주석 관리 (wp-admin + 앱 서버-서버 API)

- 상태: Accepted — 2026-07-16
- 관련: [[0005-content-in-db-admin-i18n-annotations.md|ADR-0005]](주석 도메인) ·
  [[0016-annotation-local-mirror.md|ADR-0016]](미러) · [[0017-admin-operational-surface.md|ADR-0017]]
  (인앱 admin 표면 계열) · [[0025-wordpress-headless-cms.md|ADR-0025]](CMS=WP·경계)
- 코드: `infra/wp/mu-plugins/quizdeck-cms/annotations.php` · `lib/admin-annotation-db.ts` ·
  `app/api/admin/{annotations,learners}/route.ts` · `lib/route-guards.ts` `withServiceToken` ·
  `k8s/wp/deployment.yaml` `QD_ADMIN_API_*` · `k8s/base/deployment.yaml` `ADMIN_API_TOKEN`

## 맥락

"관리자가 개별 회원의 메모(메모·밑줄·형광펜)를 관리할 수 있는가?"(사용자, 2026-07-16) — 없었다.
주석은 학습 개인 데이터로 앱 postgres `annotation` 테이블에 있고(ADR-0005 D), 모든 경로가 세션
learner_id 스코프라 admin 도 타인 주석에 닿을 수 없었다. 관리 표면 위치로 인앱 `/admin/annotations`
를 먼저 구현했으나 사용자가 **wp-admin 내부**를 확정(관리 도구 단일 진입 — 같은 날 번복), 인앱
화면은 제거했다.

## 결정

1. **관리 표면 = wp-admin 'QuizDeck CMS → 회원 주석'** (`annotations.php` 모듈). 회원 검색
   (이메일/이름) → 회원별 주석을 시험 그룹으로 조회, 행별 수정(memo·kind)과 삭제(confirm).
   admin-post + 행 단위 nonce + transient 알림 — 대시보드 액션과 같은 패턴.
2. **데이터 소유는 앱 postgres 불변 — WP 는 서버-서버 API 호출만.** 클러스터 내부 Service
   (`quizdeck.quizdeck.svc.cluster.local/api/admin`)로 GET/PATCH/DELETE. WP 는 앱 DB 에 직접
   붙지 않는다(ADR-0025 경계 유지 — revalidate 웹훅의 역방향 확장).
3. **인가 = 전용 서비스 토큰 `ADMIN_API_TOKEN`** (`withServiceToken`, route-guards 소유).
   env 미설정·헤더(X-QD-Token) 불일치 균일 401 — **fail-closed**(revalidate-content 와 같은 결).
   REVALIDATE_TOKEN 재사용 기각 — 권한 등급(캐시 무효화 vs PII 열람·회원 데이터 뮤테이션)이
   다르면 토큰을 분리해야 한 쪽 유출이 다른 쪽 권한으로 승격되지 않고, 독립 로테이션이 된다.
   조작자는 세션이 없으므로 `X-QD-Actor`(WP 로그인명, rawurlencode)로만 흘러 감사 로그에 남는다
   (memo 원문은 프라이버시상 로그 제외). 인가 판단에는 쓰지 않는다.
4. **범위 = 조회 + 수정(memo·kind) + 삭제. 생성 제외** — anchor 는 본문 텍스트 선택으로만
   만들어지는 구조(ADR-0005 결정 8)라 관리 폼 생성은 비실용, 실무 수요도 없다.
5. **admin DB 모듈 분리(`lib/admin-annotation-db.ts`)** — `annotation-db.ts` 는 "모든 쿼리
   learner_id 스코프" 불변식을 문서로 소유한다. 거기에 id 스코프 쿼리를 섞으면 불변식이 거짓이
   되므로 별도 모듈로 경계를 파일로 명시한다. 수정은 **id 기준 memo·kind 2컬럼 UPDATE** —
   anchor/field/qn/lang/learner_id 가 SQL 에 등장하지 않아 위치·소유 정보 불변이 구조적으로 보장.
6. **시험명 매핑은 WP 내부** — `qd_exam` CPT 의 `qd_exam_key` 메타 조회(미등록 키는 raw 표시).
   앱 카탈로그 API 왕복 불필요.

## 기각

- **인앱 `/admin/annotations` 화면** — 구현·검증까지 갔다가 번복(사용자 결정). 관리 진입점
  이원화 회피. 서버 계층(`admin-annotation-db` + API)은 그대로 이 설계의 기반이 됐다.
  단점 수용: wp.myquizdeck.com 이 tailnet 전용이라 tailnet 밖에서는 관리 불가.
- **WP 직접 postgres** — WP 이미지에 pdo_pgsql 없음 + ADR-0025 경계 정면 위반.
- **iframe 임베드** — 앱 세션 쿠키가 myquizdeck.com host-only 라 wp-admin 프레임에서 세션이
  성립하지 않음(쿠키 재설계 선행 필요).
- **REVALIDATE_TOKEN 재사용** — 결정 3.

## 검증

- `lib/admin-annotation-db.integration.test.ts` — 검색(부분일치·카운트·left join)·정렬·수정의
  불변(memo/kind 만 변경)·삭제를 실 postgres 로.
- `app/api/admin/{annotations,learners}/route.test.ts` — 토큰 fail-closed(미설정=무조건 401) +
  DB 미도달, 400/404/204/200.
- `infra/wp/tests/cases/90-annotations.php` — env 계약·exam 매핑·`pre_http_request` 스텁 왕복
  (메서드·토큰/actor 헤더·body 형태)·렌더 스모크.
- 배포 후: 외부에서 `/api/admin/learners` 토큰 없이 401, tailnet wp-admin 에서 검색·수정·삭제
  왕복 + 앱 감사 로그, revalidate 웹훅 회귀 없음.
