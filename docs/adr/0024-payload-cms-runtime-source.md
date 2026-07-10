# 0024 — Payload CMS: 콘텐츠 런타임 소스 전환

- 상태: Accepted — 2026-07-10 (사용자 결정: 설계 인터뷰 14문항 — 역할·스코프·배치·인증·폐기 전략 전부 명시 선택)
- 대체(3단계 완료 시): [[0005-content-in-db-admin-i18n-annotations.md|ADR-0005]] A·B(하이브리드 로더·커스텀 어드민) · [[0023-icons-collection-and-exam-override.md|ADR-0023]] 결정 2(카탈로그 파일 유지)
- 관련: [[0017-admin-operational-surface.md|ADR-0017]](admin 허브 — 전부 제거 예정) · [[0021|ADR-0021]](R2 계정 재사용)
- 코드: `payload.config.ts` · `cms/` · `app/(payload)/` · `db/payload-migrations/` · `lib/admin.ts`(isCmsRole)

## 맥락

동기 4종(사용자 명시): ① 편집 경험 개선(커스텀 에디터의 비싼 기능 — 미디어·워크플로), ② 콘텐츠
대량 확장(신규 문제집 작성 파이프라인 병목), ③ 비개발자 작성자 온보딩, ④ 기술 탐색/학습.
특히 ②·③은 "새 문제집 추가 = git 커밋+배포"(meta.json 파일 소유)와 정면 충돌한다.

## 결정

1. **Payload = 런타임 소스.** 저작 도구+publish 동기화(이중 소스 유지)가 아니라 서빙 소스 자체를
   Payload 로 옮긴다. **전부 이관** — meta·questions·concepts 는 CMS 필드로, 코드성 산출물
   (diagrams·q2svc·icons)은 raw JSON 필드로(편집 UX 는 없어도 단일 소스는 지킨다).
2. **같은 Next 앱 embed.** admin `/cms`, REST `/api/cms` — 기존 `/admin`(커스텀 어드민,
   3단계까지 공존)·`/api/collections`(학습자 컬렉션)와 충돌 회피 배치. 단일 레플리카 취미
   규모에 서비스 분리는 과대. k8s 메모리 limit 256→512Mi.
3. **같은 postgres, `payload` 전용 스키마.** `schemaName: 'payload'` — 수기 관리 테이블(public)과
   네임스페이스 경계. 마이그레이션은 `db/payload-migrations/`(생성 = `migrate:create`, 적용 =
   **배포 전 수동** `pnpm payload migrate` — `db/migrations/` 와 같은 규율).
4. **인증 = better-auth 세션 전략.** Payload 로컬 인증 OFF(`cms/auth-strategy.ts`) — 계정 체계
   단일 유지, ADR-0005 B 의 권한 경계(user.role) 계승. **`author` 롤 신설**: `/cms` 는
   `role ∈ {admin, author}`(lib/admin.ts `isCmsRole`), better-auth admin API(밴·롤 변경)는
   여전히 admin 만. cms-users 컬렉션은 세션 미러(전략이 find-or-create·role 동기화)일 뿐이다.
5. **미디어 = R2.** `@payloadcms/storage-s3` + media 전용 버킷(백업 ADR-0021 과 계정 공유,
   자격증명 분리). env 4종이 모두 있을 때만 켜진다(소셜 로그인 조건부 규칙) — 부재 시 로컬
   디스크 폴백(dev 전용, `/media` gitignore). bytea 저장(ADR-0023 애던덤)은 이관 후 폐기.
6. **i18n = Payload 네이티브 localization.** ko/en 로케일 + defaultLocale ko + fallback —
   jsonb 언어 봉투(`content-localize`)를 대체한다.
7. **렌더링 = ISR 유지.** 3단계에서 로더를 Local API 로 바꾸고 `afterChange`/`afterDelete` 훅이
   revalidatePath — 요청당 DB 조회(동적 전환)는 기각.
8. **단계적 폐기.** 구 테이블(question·concept·exam_icon_override)·`content/` 파일·seed 스크립트는
   3단계 서빙 전환 후 라이브 검증을 거쳐 별도 마이그레이션으로 drop(4단계) — 즉시 폐기 기각.

## 진행 (4단계 PR)

1. **embed+인증+스키마** (이 PR): deps·payload.config·컬렉션 정의·auth 전략·`/cms` 라우트·
   초기 마이그레이션·k8s(secret env, 512Mi). 서빙 무변경 — admin|author 만 빈 CMS 에 접근.
2. **이관+검증**: 파일+DB → Payload 이관 스크립트, "구 로더 출력 == 신 로더 출력" diff 검증(기계).
3. **서빙 전환**: lib/content·catalog → Local API, ISR revalidate 훅, 기존 `/admin`·`/api/admin`
   제거(사용자 조회는 hosted 대시보드로 일원화 — ADR-0017 확장), `/cms` 의 `/admin` 이양 여부 결정.
4. **폐기**: 구 테이블 drop·`content/`·seed 제거(별도 마이그레이션).

## 구현 노트 (1단계에서 확정된 함정들)

- **버전 고정: Payload 3.75.x.** `@payloadcms/next` 3.76+ 는 peer 가 Next 15.5 를 통째로
  제외한다(`>=15.4.11 <15.5.0 || >=16.2.6`). 현행 Next 15.5.19 를 지키려면 3.75 가 마지막 라인 —
  **Next 16.2.6+ 로 올릴 때 Payload 도 최신으로 동반 상향**한다(강제 아님, 명시적 함께-업그레이드).
- **`"type": "module"` 전환.** Payload 3 는 ESM 전용(TLA) — CJS 프로젝트에선 `ERR_REQUIRE_ASYNC_MODULE`.
  repo 에 `.js` CJS 파일이 없어 무해 전환. CLI(tsx)는 확장자 없는 상대 TS import 도 못 풀어
  config 로드 체인(payload.config → cms/*)은 `.ts` 확장자 명시(`allowImportingTsExtensions`) +
  better-auth 는 요청 시점 동적 import 로 격리했다.
- **멀티 root layout.** Payload admin 은 자체 `<html>` 이 필요 — 기존 라우트를 `app/(quizdeck)/`
  로, Payload 를 `app/(payload)/` 로 분리(URL 불변). 그룹 간 내비게이션은 풀 리로드(admin↔앱 무관).
- **`id` 는 예약 필드명(group 안에서도).** track group 의 id 가 조용히 드롭됐다 —
  `trackId`/`trackName` 평탄 필드로 우회, 로더가 재조립한다.
- **generator 는 `CREATE SCHEMA` 를 안 만든다.** 초기 마이그레이션에 수동 추가
  (`CREATE SCHEMA IF NOT EXISTS "payload"`) — 재생성 시 다시 넣어야 한다.
- **sharp 미도입.** 리사이즈/크롭 OFF(`crop:false, focalPoint:false`) — 아이콘 수준 미디어에
  네이티브 의존·이미지 비대는 과대. 지문 이미지가 커지면 재개봉.
- 검증(1단계): `next build` + `next start` 를 임시 postgres(앱 마이그레이션 0001–0010 + seed +
  payload migrate 동시 적용)로 스모크 — home/exam/health 200(회귀 없음), `/cms`·`/cms/login` 200
  (better-auth 로그인 안내 렌더), 두 스키마 공존 확인.

## 기각 대안 (재제안 방지)

- **저작 도구 + publish 동기화** — 리스크는 작지만 이중 소스(Payload+구 테이블) 유지 비용이 상시.
  런타임 소스 전환을 사용자가 명시 선택(2026-07-10).
- **별도 Payload 서비스** — Local API 포기, 배포·인증·ingress 이중화. 단일 레플리카 규모에 과대.
- **Payload 자체 계정** — 로그인 체계 2개·작성자 계정 이중 관리. 전략 구현이 지저분해지면 후퇴 옵션.
- **동적 렌더링 전환** — 요청당 DB 조회로 512Mi 단일 pod 에 부하. ISR+훅 revalidate 유지.
- **graphql 활성** — 소비자 없음. `graphQL.disable` (peer 라 패키지는 설치, 16 고정 — 17 은 peer 위반).
