# ADR-0017 — 어드민 운영 표면: 허브 + 읽기전용 사용자 목록, 관리는 호스티드 대시보드 위임

- 상태: Accepted
- 날짜: 2026-07-06
- 관련: [[0005-content-in-db-admin-i18n-annotations]](admin B — 콘텐츠 편집 표면), [[0012-learner-ia-audit]](결정 10 — admin 진입 조건부 렌더), [[0015-api-rsc-authorize-seam]](requireAdminPage), [[better-auth-dashboard]] 메모리
- 코드: `app/admin/page.tsx`(허브·신규), `app/admin/content/**`(이동), `app/admin/users/page.tsx`(신규), `lib/admin-users.ts`(신규)

## 맥락

그동안 `/admin` = 콘텐츠(Exam) 편집 목록 하나뿐이었다(ADR-0005 B). 운영자가 **사용자 현황을
보고**(누가 가입했나·검증됐나·admin 이 누구인가) 관련 인프라(대시보드·CI·이메일 로그·상태)로
바로 가고 싶다는 요구가 생겼다. 동시에 이미 **호스티드 Better Auth 대시보드**(dash.better-auth.com,
dash 플러그인)가 사용자·세션·이벤트·ban·impersonate 를 풍부하게 제공한다.

핵심 긴장: 사용자 **관리**를 앱 안에 지을 것인가, 이미 있는 호스티드 대시보드에 위임할 것인가.

## 결정

**`/admin` 을 운영 허브로 재편**하고, **인앱 사용자 화면은 읽기전용**으로 두며, **관리는 호스티드
대시보드에 위임**한다.

- IA: `/admin`(허브: 콘텐츠·사용자 영역 + 인프라 링크) · `/admin/content`(Exam 편집 목록, 기존
  `/admin` 에서 이동) · `/admin/content/[provider]/[exam]`(편집기, 이동) · `/admin/users`(신규).
- **사용자 목록(읽기전용)**: RSC 가 `user` 테이블을 직접 조회(`lib/admin-users`, `/me` 의
  loadAllProgress 대칭 — 새 API 없음). email·name·**검증여부**·role·가입일 + 요약 카운트만.
  `emailVerified === true` 가 곧 [[../../CONTEXT.md]] **Learner** 경계라 목록이 User→Learner 구분을
  드러낸다. role 판정은 순수 `isAdminRole`(lib/admin) 재사용 — 콘텐츠 인가와 같은 규칙.
- **관리 위임**: ban·역할 변경·세션 해지·삭제는 짓지 않고 사용자 화면에서 호스티드 대시보드로
  링크한다. 인프라 섹션도 admin 전용 바로가기(대시보드·GitHub·Resend·Health).

## 기각 대안

### 인앱 사용자 풀 관리 (adminClient + ban/role/delete UI)

better-auth `admin()` 플러그인의 client 짝(`adminClient`)을 붙여 목록·ban·역할·삭제를 앱 안에서.
**기각.** 호스티드 대시보드가 이미 그걸(+세션·이벤트·impersonate) 더 풍부하게 한다 — 파괴적
운영 액션을 두 곳에 이중 구현하는 것은 표면·위험만 키운다("미리 사지 않음"). 요구는 "**조회**"였다.

### /admin 을 콘텐츠 목록으로 유지하고 사용자·인프라를 곁에 덧붙임

허브 재편 없이 최소 추가. **기각** — 관심사가 3개(콘텐츠·사용자·인프라)로 늘어 랜딩이 콘텐츠
목록 하나인 건 어색하고, 콘텐츠/사용자 경로가 엇갈린다. 허브 + `/admin/content` 이동으로 IA 를
일관화했다(편집기도 `/admin/content/[…]` 로 이동 — `header-model` 의 '이 시험 편집' 링크 갱신).

## 결과

- 운영자가 한 화면에서 콘텐츠·사용자·인프라로 분기한다. 사용자 현황은 앱 안에서 즉시 보되,
  파괴적 관리는 호스티드 대시보드라는 **한 주인**에 남는다.
- 사용자 화면이 학습 데이터를 조인하지 않아(User 축) 가볍고, 검증 배지가 Learner 경계를 비춘다.
- 라우트 이동으로 `/admin/[prov]/[exam]` → `/admin/content/[prov]/[exam]`. 공개 exam 경로
  (revalidatePath 대상)·AdminLink(→ 허브)는 무영향. `header-model` admin URL 만 갱신.
- CONTEXT.md 무변경 — admin 표면·편집기·인프라는 운영 구현이라 학습 글로서리 밖('문제 CMS'는
  인앱 편집기의 구어 별칭일 뿐).
