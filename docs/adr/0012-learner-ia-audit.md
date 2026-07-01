# 0012 — Learner IA 감사: 재개/회고 스코프 사다리 · 슬림 허브 · 적응형 맥락 헤더

Status: accepted — 그릴링 2026-07-01 ([[0010-learner-ui-architecture.md|ADR-0010]] 확장·승계, 구현은 후속 슬라이스)

## 맥락

[[0010-learner-ui-architecture.md|ADR-0010]]이 화면·라우팅·반응형 **골격**(route group 섹션 · learner shell · hub-and-spoke · 하이브리드 뷰)을 세우고 구현됐다. 골격 위에서 실제로 써보니 IA 냄새가 드러났고, 이번 감사는 그것들을 전면(learner 계층)에서 정리한다. (그릴링 2026-07-01)

관찰된 냄새:

- **두 허브 역할 흐림.** [[../../app/(learner)/page.tsx|Home `/`]]은 로그인한 [[../../CONTEXT.md#Learner|Learner]]에게도 그냥 Exam 카탈로그(개인화 0)인데, "어디까지 했지/이어서"·현황은 한 단계 들어간 [[../../app/(learner)/me/page.tsx|`/me`]]에 있다. **최빈 과업과 랜딩면이 어긋난다.**
- **exam 허브 = kitchen-sink.** [[../../components/views/Home.tsx|허브]]가 5개 직무(이어하기 · per-exam 대시보드 · 연습 모드 · 참조/복습 네비 · 데이터 도구)를 한 스크롤에 욱여넣어, 1급이어야 할 "연습 시작·섹션 이동"이 곁다리(통계·도구)에 화면 절반을 내준다.
- **전역 nav 부재로 exam 깊이서 맥락 상실.** `/[exam]/concepts` 등으로 들어가면 지속되는 건 `QuizDeck` 로고뿐 — 어느 시험인지·검색·허브 복귀가 브라우저 뒤로가기에 의존.
- **진도(Progress)가 스코프 없이 흩어짐** — 허브 통계·`/me` 대시보드가 같은 성격을 중복.
- **admin 진입점 부재.** admin은 [[../../lib/admin.ts|role=admin]]인 Learner가 쓰는데 learner 셸에 문이 없어 `/admin` URL을 외워 들어간다.

## 결정

1. **뿌리 프레임 = 단일 시험 집중형 + 얕은 다시험 인지.** 한 Learner는 여러 Exam Progress를 갖지만(용어집), 현실 학습은 **한 자격에 몰빵 + 1~2개 유지**다. 통근·자투리 폰 학습이라 한 번 열면 그 시험 안에 머문다. 아래 모든 결정의 근거.

2. **최상위 면 역할 = 동사로 가른다 (Model 1).** **Home = 재개(act)**, **`/me` = 회고+관리(reflect+manage)**. `/me`는 **`/me`(전 시험 인덱스) + `/me/account`(계정 관리)**로 분리 — 파괴적·저빈도 계정 액션(탈퇴)을 회고 스크롤에서 격리.

3. **Home continue = 동기화되는 Progress로 뼈대.** 로그인 시 상단에 **Progress 기반 "최근 학습한 시험" 카드**(cross-device 일관 · 최근 활동순 **최대 3**) + 아래 카탈로그(전환·발견). 진행 중 [[../../CONTEXT.md#Session|Session]]은 **기기 로컬·미동기**라 카드 위 **"이 기기서 이어풀기" 보조 배지**로 강등. **익명 = 카탈로그만**(Progress 없음).

4. **exam 허브 = 슬림 런처.** 이어하기 배너 + 모드 그리드(1급) + 두 묶음 참조/복습 네비 + **압축 현황 한 줄**(Mastery% · 연속일 · 오늘 목표) + "현황 자세히 ›". per-exam 심화 통계와 데이터 도구는 허브 본문에서 **분리**.

5. **섹션 = 두 묶음 + 검색 승격.** `학습 자료`(개념·서비스맵·다이어그램) / `내 학습`(내 문제함·히스토리)로 라벨링. **검색은 목적지 섹션이 아니라 자료를 가로지르는 도구** → 카드에서 빼서 맥락 헤더의 지속 어포던스로.

6. **적응형 단일 맥락 헤더 (3단 축소).** hub-and-spoke 유지(하단탭 재도입 아님)하되 헤더를 맥락 적응형으로. **밖(카탈로그·/me)** = `QuizDeck + 계정`; **exam 안** = `‹시험명(→허브) · 🔎검색 · 계정`; **퀴즈 active** = `진행 n/N · (타이머) · 나가기`. 두 줄로 쌓지 않고 exam layout이 맥락을 채운다(모바일 세로 예산).

7. **진도 스코프 사다리.** per-exam 심화는 **`/[provider]/[exam]/stats` 라우트**(허브 스포크), `/me`는 **cross-exam 인덱스**로 재규정. `/me`(전부) → 허브(하나·글랜스) → `/stats`(하나·심화) → Home(재개)의 **드릴다운** — 같은 숫자를 네 번 보여주는 중복이 아니라 상하 관계. **히스토리(지난 시도)는 `/stats`로 흡수**(별도 top 카드 아님).

8. **관리/설정면 격리.** 계정 관리 → `/me/account`. per-exam 데이터 도구(리포트·**초기화**·백업/복원) → `/stats` 하단 "이 시험 데이터"(per-exam이라 cross-exam `/me` 아님).

9. **퀴즈 chrome = phase별 축소.** setup/result = 정상 맥락 헤더(시도 사이라 이동 유의미), **active = focus chrome**(진행·타이머·나가기만; 검색·허브·계정 숨김). 뒤로가기 = 나가기 확인/일시정지, 이탈 시 Session은 이어하기로 보존.

10. **admin 진입 = 맥락 primary + /me 보조, 전역 헤더 admin-free.** admin의 실제 직무는 **콘텐츠 편집**이라 "글로벌 문"보다 **맥락 문**이 맞다. **주 진입 = exam 맥락 헤더의 admin 전용 `✏️ 이 시험 편집`**(→ [[../../app/admin/[provider]/[exam]/page.tsx|`/admin/[provider]/[exam]`]] 딥링크, 3-홉→1-홉). **보조 = `/me`의 `어드민`**(전체 목록 진입). 일반 Learner IA에 admin 흔적을 안 남긴다. [[../../lib/learner.ts|`isLearner`]]와 대칭인 **클라-안전 `isAdminRole(session)`** 술어 하나 추가로 조건부 렌더(세션이 이미 role을 실어옴).

## 왜

- **단일-집중 프레임** — 매일 하는 게 "한 시험 재개"라 Home엔 가벼운 continue만, 전 시험 집계는 저빈도 회고라 전용 면(/me)이 맞다. 스코프로 가르면 대시보드가 여러 곳에 있어도 중복이 아니라 드릴다운.
- **동기화 Progress를 뼈대로** — 어느 기기서 열어도 같은 랜딩. 미동기 Session은 "있으면 좋은" 로컬 보조로 강등해 "폰엔 이어풀기 뜨는데 노트북엔 없네" 혼란을 피한다.
- **슬림 허브** — 허브의 1급 시민은 "연습 시작·섹션 이동". 대시보드·도구는 곁다리라 스포크(/stats)·격리(/me/account, /stats 하단)로 밀어 첫 화면을 스캔 가능하게.
- **맥락 헤더 하나** — hub-and-spoke의 약점("지금 어디·어떻게 나가지")을 하단탭 없이 헤더 하나로 메운다. 섹션 스위처까지 안 가는 이유는 그게 하단탭 과밀로 되돌아가는 길이라서.
- **admin 맥락 진입** — admin의 병목은 `/admin` 도달이 아니라 "고칠 그 콘텐츠 도달"이다. 보던 시험으로 바로 착지가 워크플로와 정합하고, 전역 헤더를 admin-free로 유지한다. 맥락 헤더는 이미 존재해 비용이 작다([[0008-ui-interaction-and-components.md|ADR-0008]] "미리 사지 않음" — 드롭다운/역할토글은 선제 구축).

## 고려한 대안 (재제안 방지)

- **Model 2 — 대시보드를 Home으로(/me=계정만)** — "진도 한 곳"엔 깨끗하나 Dashboard를 /me→Home 이사(churn) + Home이 익명/학습자 분기를 무겁게 짐. Model 1이 churn 적고 단일-집중과 정합(매일=한 시험 재개, 가끔=전체 리뷰).
- **하단탭 / 상단 스크롤탭 전역 nav** — [[0010-learner-ui-architecture.md|ADR-0010]] 결정 5 재확인. 목적지 과밀·발견성↓. 맥락 헤더가 낫다.
- **kitchen-sink 허브 유지(순서만 정리)** — 곁다리가 여전히 화면을 먹는다. 슬림 런처 + 스포크 분리가 스캔성↑.
- **/me 단일 스크롤(인덱스+계정)** — 파괴적 탈퇴가 회고 스크롤과 섞인다. 격리(/me/account)가 안전.
- **검색을 목적지 카드로 유지** — 검색은 자료를 가로지르는 도구지 섹션이 아니다. 지속 어포던스가 맞다.
- **per-exam 통계를 허브 인라인 / `/me` 대시보드 필터 재사용** — 인라인은 허브를 다시 무겁게, 필터 재사용은 스코프(전부↔하나)를 흐린다. 전용 `/stats` 라우트가 드릴다운을 명료화.
- **admin 진입 = 헤더 글로벌 칩 / 계정 드롭다운 / URL-only** — 글로벌 칩은 도달만 시키고 편집기서 시험 재탐색(맥락 문이 1-홉). 드롭다운은 메뉴 a11y 비용 + 로그아웃 이전. URL-only는 운영자 discoverability 0. 맥락+/me 조합이 낫다.
- **백업/복원 즉시 제거** — 인증·동기화([[0003-auth-and-progress-sync.md|ADR-0003]]) 후 반쯤 vestigial이나 존치 여부는 이 IA 감사 밖 별도 판단. 이번엔 옮기기만.

## 결과

- **스코프 규칙(고정)**: 진도 4면 — Home=재개 affordance(숫자 최소) · 허브=이 시험 한 줄+상세링크 · `/stats`=이 시험 심화 · `/me`=전 시험 롤업.
- **신규 라우트**: `/(learner)/[provider]/[exam]/stats`, `/(learner)/me/account`.
- **리팩터**:
  - [[../../components/views/Home.tsx|허브]] 분해 — 통계 패널·주제별 정답률 → `/stats`로, 데이터 도구 → `/stats` 하단, 히스토리 카드 → `/stats` 흡수. 허브엔 이어하기·모드·두 묶음 네비·한 줄 현황·"현황 자세히"만.
  - [[../../app/(learner)/page.tsx|Home]] — 로그인 시 continue 카드(최근 Progress·최대 3) + 카탈로그, 익명=카탈로그.
  - [[../../app/(learner)/layout.tsx|(learner) layout]] 헤더 적응형화 + exam layout이 맥락(시험명·검색·편집) 채움; 퀴즈 active는 focus chrome.
  - [[../../components/AccountChip.tsx|AccountChip]] — admin은 **전역 칩 아님**(맥락 헤더 `✏️ 이 시험 편집` + `/me` `어드민`).
  - [[../../app/(learner)/me/page.tsx|`/me`]] — [[../../lib/dashboard.ts|`buildDashboard`]]를 "인덱스"로 재라벨(이미 시험별 집계라 저churn), 계정 블록 → `/me/account`.
- **lib**: `isAdminRole(session)` 클라-안전 술어([[../../lib/learner.ts|lib/learner]] 대칭 — 서버 `getAdminSession`은 유지).
- **[[../../CONTEXT.md|CONTEXT.md]] 무변경** — 재개/회고·맥락 헤더·드릴다운·묶음·슬림 허브는 **UI 아키텍처 용어**이지 도메인 글로서리(Exam·Learner·Progress·Session·Mastery·내 문제함·Annotation)가 아니고, 이 감사는 용어의 **뜻을 바꾸지 않았다**([[0010-learner-ui-architecture.md|ADR-0010]] "CONTEXT.md 무변경" 선례와 동일).
- **admin 섹션 내부·desktop-first**([[0010-learner-ui-architecture.md|ADR-0010]] 결정 1)·모바일 터치 주석 보류(0010 결정 6 승계)는 **범위 밖**.
- **후속/보류**: 백업·복원 vestigial 존치 판단 · admin **항목 단위** 앵커링(현 편집기는 per-exam) · 히스토리 완전 흡수 검증.
- **슬라이스화(후속 이슈)**: **(A)** 최상위 면(Home continue+카탈로그 · /me 인덱스 + /me/account), **(B)** 허브 슬림화 + 두 묶음 네비, **(C)** 적응형 맥락 헤더 + 검색 승격 + 퀴즈 phase chrome, **(D)** `/stats`(허브 통계 이사 + 히스토리 흡수 + 데이터 도구), **(E)** admin 맥락 진입 + `isAdminRole`. **C는 B의 슬림 허브에, D는 C의 헤더에 의존**.
