# 0025 — WordPress(headless)로 CMS 계층 전환

- 상태: Accepted — 2026-07-13 (설계 인터뷰 7문항 — 역할·호스팅·DB·모델링·다국어·API·노출)
- 대체(완료 시): [[0024-payload-cms-runtime-source.md|ADR-0024]] 의 Payload 계층
- 관련: [[0020-argocd-tailnet-visibility.md|ADR-0020]](tailnet 노출 패턴 계승) · [[0021|ADR-0021]](백업 — MariaDB 추가 필요) · `infra/db-vm/`(격리 원칙)
- 코드: `infra/wp-db/` · `infra/wp/` · `k8s/wp/` · `.github/workflows/wp-image.yml`

## 맥락

사용자 결정: "Payload 강점이 약하므로 WordPress 로 전환"(2026-07-13). 어시스턴트의
기술 평가는 **반대 의견**이었다 — 이 아키텍처(구조화 퀴즈 데이터 + 커스텀 Next 앱)에는
Payload 적합성이 높고, WP 전환은 MySQL 인프라 신설·검증 PHP 재개발·기능 손실(대시보드·
라이브 프리뷰·원자 반입·단일 계정)·보안 운영 부담을 수반한다고 고지했다. 비용·손실
가격표를 제시한 뒤 사용자가 **전손실 수용 + 전환 강행**을 확정 — 그 위에서의 계획이다.
(재제안 방지: 이 반대 의견과 가격표는 기록으로 남긴다.)

## 결정 (인터뷰 확정)

1. **Headless 전용.** WP 는 콘텐츠 저작·관리만 — 학습 앱(Next)·better-auth·학습 데이터
   무변경, 서빙만 WP REST 로 교체. WP-프론트 전면 전환은 실행 불가 규모로 기각.
2. **k3s 셀프호스팅 + db-home MariaDB.** WP 는 postgres 미지원(확정 사실 — PG4WP 류
   심은 프로덕션 부적격) → 기존 DB VM 에 MariaDB 추가, 격리 불변식 동일(3306 = k3s 만).
3. **모델링 = CPT 3종 + ACF Pro(유료) + 검증 커스텀 플러그인**(정답⊆보기·qn 유일성 —
   PHP 자체 유지보수).
4. **ko 단일** — 다국어 플러그인 미도입(현 데이터 ko 뿐), 필요 시 재개봉.
5. **코어 REST** — 게시본 공개 GET + ISR 유지 + 편집 웹훅→revalidate. GraphQL 기각
   (플러그인 최소화).
6. **admin = tailnet 전용**(ADR-0020 패턴: grey-cloud DNS + IngressRoute + DNS-01) —
   WP 최대 공격 표면을 구조적으로 차단. 앱 read 는 클러스터 내부 Service.
7. **무상태 pod + 이미지 고정.** `DISALLOW_FILE_MODS` — 코어·플러그인은 이미지·CI 가
   소유(GitOps), html 은 emptyDir, 미디어는 R2 offload(2단계).
8. **기능 손실 전손실 수용**(사용자 확정): 운영 대시보드·라이브 프리뷰·JSON 원자 반입·
   단일 계정(better-auth) 포기. 초안·리비전은 WP 네이티브로 유지.

## 진행 (4단계 — ADR-0024 병행 패턴 계승)

1. **인프라**(이 PR): MariaDB 프로비저닝 키트 · WP 이미지 파이프라인(wp-image.yml →
   ghcr quizdeck-wp) · k8s/wp(+tailnet IngressRoute) · Argo App. 부트스트랩(사용자):
   db-home 콘솔에서 provision 실행 → Secrets → grey-cloud DNS → Argo App apply.
2. **모델링·이관**: ACF Pro(라이선스 — 사용자 구매) + CPT/필드 코드화 + 검증 플러그인 +
   payload→WP 이관 스크립트 + **구==신 diff 기계 검증**. 백업 cronjob 에 mariadb-dump 추가.
3. **서빙 전환**: cms/serve.ts → WP REST 클라이언트, 웹훅→revalidate, 링크 정리.
4. **폐기**: Payload 의존성·cms/·(payload) 라우트 제거 + payload 스키마 drop(라이브 검증 후).

Payload 는 3단계 검증 전까지 라이브 병행 — 서빙 소스는 검증된 뒤에만 바뀐다.

## 애던덤 — 2·3단계 완료 (2026-07-13)

- **2단계**: quizdeck-content mu-plugin(ACF 대체 자체구현 — 사용자 재결정: headless 라 필드
  프레임워크의 가치는 admin UI 뿐, 목적 제작 폼이 UX·저장 포맷 우위. 정답 = 보기 key
  체크박스로 정답⊄보기가 구조적으로 불가). 라이브 이관 787문항·228개념 + diff 기계 검증
  전 섹션 일치. MariaDB 백업 cronjob(KST 03:20). **WP 함정 기록**: update_post_meta 는
  unslash(wp_slash 필수) · sanitize_textarea_field 는 <…> strip(충실 저장 부적합) ·
  get_the_title 은 wptexturize(raw 는 get_post_field) · REST 저장 시 save_post 가 필드
  콜백보다 먼저(REST_REQUEST skip) · PHP 는 빈 연관배열 표현 불가({}↔[] 클라 정규화) ·
  REST orderby 는 enum 화이트리스트(커스텀 파라미터로 우회) · app password 는 HTTP 비활성
  (로컬은 WP_ENVIRONMENT_TYPE=local).
- **3단계**: 서빙 = WP REST(cms/wp-client — 클러스터 내부 Service, ko 단일 봉투 재구성).
  cms/serve.ts 시그니처 유지(소비처 무변경). 편집 웹훅(webhook.php, 게시본 영향 시에만)
  → /api/revalidate-content(공유 토큰, layout revalidate) — Payload 훅의 WP 등가.
  admin 링크(헤더·/me) → wp.myquizdeck.com. site-config 는 payload 잔존(4단계에서 WP
  옵션 이관 예정 — serve-siteconfig.ts). 검증: 로컬 풀 스택 — 홈·exam WP 데이터 렌더,
  WP 전용 수정 마커가 서빙에 반영(소스 전환 증거), 웹훅 401/200.

## 애던덤 — 4단계 폐기 완료·전환 완결 (2026-07-13)

- **site-config 이관**: payload Global → WP 옵션(설정→QuizDeck, Settings API) + 공개 REST
  (/wp-json/qd/v1/site-config). 저장 시 scope=site 웹훅 → 루트 layout revalidate. 앱 로더는
  어떤 실패에도 기본 문구 폴백 — 배포 순서·설정 가용성에 인질 안 잡힘(payload 저장값은
  없었음 — 이관 데이터 0).
- **Payload 전면 제거**: 의존성 10종(payload·@payloadcms/* 8·graphql), payload.config·
  (payload) 라우트·cms/read·auth-strategy·컬렉션·admin 컴포넌트·cms-preview·이관/검증
  스크립트·db/payload-migrations·isCmsRole. withPayload·@payload-config·PAYLOAD_SECRET·
  R2_MEDIA_* 배선 제거. /admin(구 payload)은 404 — CMS 는 wp.myquizdeck.com.
- **운영 정리**: payload 스키마는 앱 배포 확인 **후** drop(0011 선례 — 후적용 무해).
  quizdeck-auth 의 PAYLOAD_SECRET·R2_MEDIA_* 키와 R2 media 버킷(빈 상태)은 잔여물 —
  제거 가능(README 갱신).
- 검증: payload 제거 앱이 라이브 WP 를 읽어 홈·시험 렌더 + 설정 REST 미배포 상태에서
  폴백 동작(순서 안전성 실증). 테스트 322·빌드 0.

이로써 CMS 계층 = WordPress 단일. Payload 관련 코드·스키마·의존성은 저장소·클러스터에서
사라졌다(이력은 git·ADR-0024 에 보존).

## 기각 대안 (재제안 방지)

- **pg 재사용** — WP 가 MySQL 계열 전용이라 불가(기술 사실, 선호 아님).
- **매니지드 WP** — 비용·외부 의존, self-hosted 원칙과 상충. 셀프호스팅 선택.
- **WPGraphQL** — 조회 패턴에 과유, 플러그인 표면 최소화.
- **공개 admin 서브도메인** — 상시 공격 표면. tailnet 전용 선택.
