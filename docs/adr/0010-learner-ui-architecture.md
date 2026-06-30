# 0010 — Learner UI 아키텍처: mobile-first + 화면(섹션) 모델

Status: accepted — 그릴링 2026-06-30 (구현은 후속 슬라이스)

## 맥락

현재 UI 는 **반응형이 거의 없고**(브레이크포인트 ~13곳) 화면마다 `max-w-*` 가 제각각이며 공유
레이아웃·전역 nav 가 없다. 로그인은 **모달**(home 의 [[../../components/AccountMenu.tsx]] 인라인 +
연습 게이트 [[../../components/LoginModal.tsx]])이고, 학습은 [[../../components/ExamApp.tsx]] 의
**9-view 클라이언트 SPA**(home·setup·quiz·result·concept·diagram·map·search·history 가 URL 하나
아래 `view` state 로 전환)다. 마이페이지=`/me`, 관리자=`/admin*`.

학습은 통근·자투리 시간에 폰으로 짧게 푸는 패턴이라 **학습자 화면은 mobile-first** 가 맞으나 현재는
데스크톱-ish 단일 컬럼 고정이다. 모바일 핵심 통증: 학습 중 **뒤로가기가 view 가 아니라 시험을 나간다**.
[[../../CONTEXT.md#Annotation|Annotation]] 생성은 마우스 선택(`onMouseUp`/`getSelection`) 기반이라
터치에선 툴바가 거의 안 뜬다.

[[0008-ui-interaction-and-components.md|ADR-0008]](상호작용 affordance·무의존 컴포넌트)·
[[0009-icon-system.md|ADR-0009]](아이콘)는 컴포넌트·토큰 층을 세웠으나 **화면·라우팅·반응형 층의
방향이 없다.** 이 ADR 이 그 방향을 고정한다. (그릴링 2026-06-30)

## 결정

1. **기기 우선순위가 계층마다 다르다.** 학습자 화면(로그인·학습·마이페이지)은 **mobile-first**(폰 =
   1순위 학습 기기), 관리자는 **desktop-first**(콘텐츠 편집 = 키보드·넓은 화면). 두 계층의 최적화
   목표·레이아웃이 갈린다.
2. **화면은 route group 섹션 레이아웃으로 가른다.** `(learner)` 그룹(home·학습·마이페이지)은
   mobile-first 공유 shell(일관 container·슬림 sticky 헤더·safe-area), `admin/` 은 desktop chrome,
   `(auth)` 는 로그인 — 섹션마다 `layout.tsx` 하나. URL 불변. "화면 구분"이 폴더 구조로 드러나고
   섹션별 기기 최적화가 한 곳에 모인다(화면마다 반복 회피).
3. **로그인 = `/login` 라우트 + 연습 게이트는 in-context 모달.** `/login` 은 mobile-first 풀스크린
   (현 `max-w-xs` 인라인 폼보다 낫다). 단 연습 게이트는 학습 상태·막힌 액션(`pendingPractice`) 재개를
   보존해야 하므로 모달 유지(모바일 bottom-sheet). [[../../components/AuthForms.tsx|AuthForms]] 공유.
4. **학습 view = 하이브리드.** 참조 뷰(concept·diagram·map·search·history)는 **라우트**
   (`/[provider]/[exam]/concepts` 등) — 뒤로가기 자연·딥링크·코드분할. 퀴즈 플로(setup→quiz→result)는
   **한 라우트의 집중 상태 플로** — 세션(queue·position·선택)이 무거워 라우팅 비용이 크고 한 흐름이다.
   모바일 뒤로가기 가치가 큰 쪽만 라우팅한다.
5. **exam 네비 = 허브-앤-스포크.** `/[provider]/[exam]` 은 허브(퀴즈 시작 + 참조 섹션 카드), 각 섹션은
   라우트로 진입하고 뒤로가기로 복귀한다. 섹션이 많아도 깔끔·확장 용이·뒤로가기 정합. 퀴즈는 진입 후
   집중 풀스크린(chrome 경쟁 없음).
6. **주석 터치는 보기 = 어디서든, 생성 = 데스크톱-우선.** 주석 렌더(밑줄·형광펜·메모)는 모든 기기에서
   동작한다. 생성 툴바(마우스 선택)는 desktop-first 유지 — 터치 텍스트-범위 선택 + 커스텀 툴바는 비용·
   기기편차가 크다. **모바일 터치-생성은 명시적 후속 과제**(조용한 break 아님 — 알려진 스코프). 모바일
   핵심 동작은 퀴즈라 우선순위가 일치한다.
7. **반응형 토대.** 섹션별 일관 container 폭(화면마다 `max-w` 제각각을 수렴), mobile-first 브레이크포인트
   (기본 = 단일 컬럼, `sm:`/`md:` 로 확장), 터치 타겟 ≥44px(ADR-0008 affordance floor 확장), 퀴즈는
   모바일 풀스크린.

## 왜

- **mobile-first 학습자** — 실제 1순위 기기. 뒤로가기·딥링크·풀스크린이 폰 학습 경험을 좌우한다.
- **route group 섹션** — Next.js 관용. "화면 구분"을 폴더·layout 으로 명시화하고 섹션별 기기 최적화를
  한 곳에 모은다(화면마다 반복 회피).
- **하이브리드 view** — 참조는 라우팅 이득(뒤로가기·딥링크)이 크고 상태가 가볍다; 퀴즈는 라우팅 비용
  (세션 생존)이 크고 한 흐름이라 상태 플로가 맞다. "미리 사지 않음".
- **허브 네비** — 섹션 수에 견고하고 뒤로가기와 정합. 하단 탭(목적지 5~6 과밀)·상단 스크롤탭(발견성↓)
  보다 낫다.
- **게이트 모달 유지** — 라우트 이동은 막힌 액션 재개를 잃는다. in-context 가 전환 유도에 맞다
  ([[0004-login-gating-and-email-verification.md|ADR-0004]] 결정 2 의 "게이트 = 클라이언트 UX" 승계).
- **터치-생성 보류** — 모바일 선택 UX 는 악명 높게 까다롭고 주석은 파워/2차 기능. 보기는 살리고 생성은
  데스크톱부터, 후속에 재검토.

## 고려한 대안 (재제안 방지)

- **전부 데스크톱-우선 / 유동 동등** — 학습 = 폰 1순위에 어긋나거나(데스크톱) 범위 폭증·디자인 결정
  과다(유동 동등). 계층별 우선순위가 더 명료하다.
- **9 view 전부 라우트화** — 완전 딥링크나 퀴즈 세션 생존 리팩터·회귀 위험 최대. 하이브리드가 비용↔가치
  절충.
- **view 유지 + history pushState** — 뒤로가기만 고치나 딥링크 없고 hacky 하며 큰 ExamApp 그대로. 라우팅이
  정공법.
- **로그인 모달만 / 라우트만** — 모달만은 모바일 주 로그인이 좁고, 라우트만은 게이트 액션 재개를 잃는다.
  둘 다(라우트 + 게이트 모달)가 맞다.
- **하단 탭 / 상단 스크롤탭 네비** — 목적지 과밀·발견성. 허브가 낫다.
- **터치 주석 풀지원 / 터치 재설계** — 비용·기기편차(풀지원) 또는 큰 재설계(ADR-0005 D 재검토). 이번
  패스 범위 밖 — 후속.

## 결과

- **라우트 재구성**: `app/` 을 `(learner)`·`admin/`·`(auth)` route group 으로; 학습을 exam `layout`
  (콘텐츠 로드 + StoreProvider·AnnotationProvider) + 참조 sub-route page + 퀴즈 route 로 분해. `/login` 신규.
- **레이아웃 시스템**: learner shell(container·sticky 헤더·safe-area) + 섹션별 일관 폭 + 반응형 토대
  (mobile-first 브레이크포인트·44px 타겟).
- **컴포넌트**: ExamApp 의 view-switch → 라우트 + 허브로; LoginModal 은 게이트 전용 모달(bottom-sheet)로
  유지; AuthForms 를 `/login`·모달이 공유.
- **도메인**: [[../../CONTEXT.md|CONTEXT.md]] 무변경(shell·섹션·허브는 UI 아키텍처 용어이지 도메인
  글로서리 — Exam·Learner·Progress·Annotation — 가 아니다). ADR-0004(게이트=UX)·0005 D(주석)·0008
  (affordance)·0009(아이콘) 승계.
- 후속 이슈로 슬라이스화: **(A)** route group 섹션 + learner shell + 반응형 토대, **(B)** 학습 하이브리드
  라우팅(참조 라우트 + 허브, 퀴즈 상태 플로), **(C)** `/login` 라우트, **(D)** 마이페이지·관리자
  mobile/desktop 다듬기. **B 는 A 의 shell·네비에 의존**한다.
- 구현 메모: **B 는 B1·B2 로 나눠 전달**. **B1** = 참조 뷰를 라우트로 + 허브, 퀴즈는 index 의 상태 플로
  유지(컨트롤러 미이동 — 저위험). **B2** = 퀴즈 컨트롤러·phase 를 exam `layout`(ExamProviders 내부
  ExamQuizFlow)으로 올려 **`/quiz` 라우트**로 분해(허브·/quiz·검색 studyOne 이 한 컨트롤러 공유,
  studyIntent 우회 제거). 알려진 한계: 세션·진도가 클라이언트 해석이고 학습 페이지는 정적 프리렌더라
  익명→Learner hydration 전환(dev 경고·짧은 flash)이 있다 — 선재 특성, 서버 세션 해석(정적↔동적
  트레이드오프)으로의 근본 해결은 별도 과제.
