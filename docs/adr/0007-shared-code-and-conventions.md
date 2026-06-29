# 0007 — 공통 코드 관리: UI 프리미티브 · 도메인 유틸 · 추출 규약

Status: accepted

## 맥락

코드베이스가 인증([[0004-login-gating-and-email-verification.md|ADR-0004]])·콘텐츠/i18n/주석([[0005-content-in-db-admin-i18n-annotations.md|ADR-0005]])·마이페이지/대시보드([[0006-mypage-learner-hub.md|ADR-0006]])로 커지며, **평면 `components/`·`lib/`** 위에서 공통 패턴이 **복사-붙여넣기**로 번지고 있다. 구체적으로:

- **폼 `Field`**(label+input 한 쌍, 같은 클래스)가 `components/AuthForms.tsx`·`components/MyPage.tsx`·`app/reset-password/page.tsx` **3곳**에 각각 정의돼 있다.
- **폼 피드백 `Msg`**(`--bad`/`--good` 텍스트 + `role=alert/status`)가 위 같은 폼 뷰들에 반복된다.
- **이메일 정규화 `trim().toLowerCase()`**가 `AuthForms`(`cleanEmail`)·`MyPage` **2곳**에 흩어져 있다(같은 의도: 모바일 자동완성 공백/대문자 차단).
- 가장 무거운 건 **날짜/연속학습일**이 **두 개의 갈라진 구현**으로 존재한다는 것이다. `lib/progress.ts:dayKey`가 활동 키를 **UTC**(`toISOString().slice(0,10)`)로 발급하는데:
  - `lib/store.ts:streak`(69–80)는 키를 **UTC**(`toISOString`, 73)로 만들면서 날짜 스텝은 **로컬**(`d.setDate(d.getDate()-1)`, 76)으로 — **혼합 TZ**. 고정 오프셋(KST, DST 없음)에선 우연히 -24h라 일치하나, **DST 지역에선 23/25h 스텝으로 UTC 키가 중복·누락**돼 연속일을 오산한다.
  - `lib/dashboard.ts:overallStreak`(50–61)는 완전 **UTC**(`setUTCDate/getUTCDate`)다.

  즉 **같은 "연속학습일" 개념이 두 번 구현**돼 있고(`store.streak` ↔ `overallStreak`), 하나는 잠재 버그를 안고 있으며, 둘은 언제든 표류할 수 있다.

공통 코드가 **어디 살고 언제 추출하는지** 규약이 없어, 새 기능마다 다시 복사한다. 이 ADR은 (a) 공통 코드의 자리, (b) 1차로 통합할 대상, (c) 앞으로의 추출 규약을 고정한다.

## 결정

1. **공통 UI 프리미티브는 `components/ui/`.** 반복되는 표현 프리미티브 — `Field`(label+input), `Msg`(폼 피드백 bad/good), 후속의 `StatTile`(`Home.Stat`/`Dashboard.Tile`의 큰 숫자+작은 라벨) — 를 `components/ui/`로 모아 **단일 출처**로 둔다. 각 화면은 거기서 import 한다.
2. **공통 순수 유틸은 평면 도메인 모듈.** 레포의 기존 평면-`lib` 관습(`lib/progress.ts`·`lib/dashboard.ts`·`lib/store.ts`…)을 따라 깊은 중첩 없이 `lib/dates.ts`(날짜/일자/연속일)·`lib/format.ts`(문자열 정규화) 같은 **평면 도메인 모듈**에 둔다. DOM 무접촉 순수 함수라 클라(store)·서버(dashboard RSC) 양쪽에서 import 가능해야 한다.
3. **날짜/연속일은 UTC 단일 기준.** `dayKey`·`today`·`streak`·`overallStreak`을 `lib/dates.ts`로 통합하되 **UTC를 표준**으로 한다 — 활동 키를 발급하는 `dayKey`가 이미 UTC이므로 그것과 일치시킨다. 이로써 `store.streak`의 혼합 로컬/UTC 스텝(DST 잠재 버그·`overallStreak`와의 중복)이 **하나의 정준 pure-UTC `streak`**으로 수렴한다. KST(DST 없음) 사용자에겐 동작 변화가 없고(−24h ≡ UTC 하루), DST 지역에선 교정된다.
   - **"로컬-day" UX(사용자 자정에 연속일이 넘어가는)는 별도 제품 결정**이다. 그건 저장 의미(`dayKey` 자체)를 바꿔야 하고 이미 저장된 day-키 데이터에 영향을 준다 — 이 ADR은 **채택하지 않고 분리**한다. 여기서는 "두 구현을 하나로, 저장과 일치하는 UTC로"만 한다.
4. **1차 슬라이스 = 고가치 부분집합.** 입증된 중복만 먼저 추출한다: `Field`·`Msg`·이메일 정규화·날짜 통합(버그 수정). 가치가 낮은 것(`StatTile`은 2곳·동일이나 저위험, 버튼 클래스 토큰)은 **건드릴 때 따라오는 fast-follow**로 미룬다. 한 번에 ~10파일을 갈아엎는 빅뱅을 피하고 즉시 가치를 얻는다.
5. **추출 규약 = "2번째 중복에서 추출".** 한 번 복사는 허용한다. **두 번째** 등장에서 `components/ui/`(UI) 또는 알맞은 평면 `lib/*`(순수)로 올린다 — 조기 추상화는 피하면서 N-way 표류는 막는다. 이 규약을 ADR에 박아 앞으로 기능이 재복사 대신 이를 따르게 한다.

## 왜

- **두 개의 갈라진 streak 구현**이 "규약 부재"의 구체적 비용이다 — 실제 잠재 버그(DST)와 보장된 표류 위험. 하나로 합치면 둘 다 사라진다.
- `components/ui/` + 평면 `lib/*`는 레포의 **현재 모양**(평면 lib, 화면 옆 컴포넌트)을 그대로 따른다 — 새 빌드 개념·디렉터리 깊이 없이 마찰이 가장 낮은 자리.
- "2번째 중복에서 추출"은 작은 코드베이스에 맞는 **선명하고 비관료적인 규칙**이라 판단 비용 없이 일관성을 준다.

## 고려한 대안 (재제안 방지)

- **전체 스윕(빅뱅 리팩터)** — 찾은 중복 전부(`Field`·`StatTile`·`Msg`·버튼 토큰·이메일·dates)를 한 번에. 더 완전하나 ~10파일 동시 변경으로 위험·범위가 크고 요청 범위를 넘는다. 점진(슬라이스)으로 기각.
- **streak을 로컬-day UX로 전환** — 비UTC 사용자에겐 더 자연스러우나 `dayKey` 저장 의미와 모든 day-키 데이터를 바꿔야 한다. 범위 밖의 **별도 제품 결정**으로 분리.
- **깊은 디렉터리(`components/ui/forms/…`, `lib/utils/date/…`)** — 현재 규모엔 과설계. 평면이 레포 관습에 맞는다.
- **`Stat`/`Tile` 즉시 통합** — 2곳·동일 시그니처라 규약상 이미 추출 대상이나 저위험이라, 결정 4의 우선순위(마찰 큰 항목 먼저)를 따라 fast-follow로 둔다.
- **공통 코드를 단일 배럴(`lib/ui.ts` 등)로** — 한 파일에 몰면 다시 거대 모듈. 관심사별 평면 모듈이 낫다.

## 결과

- **1차(고가치)** — 새 `components/ui/Field.tsx`·`components/ui/Msg.tsx`(`AuthForms`·`MyPage`·`reset-password`가 import), 새 `lib/dates.ts`(`dayKey`·`today`·`streak`·`addDays` — 전부 UTC; `store`·`dashboard`·`progress`가 여기서 가져오고 혼합-TZ `store.streak`은 제거), 새 `lib/format.ts`(`normalizeEmail` — `AuthForms`·`MyPage`가 사용).
- **테스트** — `lib/dates.test.ts`가 **날짜 경계를 가로지른 UTC streak**을 핀(옛 `store.streak`이 DST 지역에서 놓칠 수 있던 회귀). 기존 store/dashboard 테스트는 `lib/dates`에서 import 하도록 갱신.
- **추출 규약**은 본 ADR에 기록(결정 5). 일상 발견성을 위해 구현 시 짧은 노트를 더할 수 있으나, CONTEXT.md(순수 도메인 글로서리)에는 넣지 않는다.
- **후속 이슈** — (fast-follow) `StatTile` 통합 + 버튼 클래스 토큰. (제품, 분리) `streak` 로컬-day UX 검토 — 채택 시 `dayKey` 저장 의미 변경을 동반.
