# 프론트엔드 반응성·상호작용성 개선 설계

날짜: 2026-07-15 · 브랜치: `feat/interaction-polish`

## 문제

- hover 는 20여 파일에 `hover:text-[var(--...)]` 로 산재하나 대부분 transition 이 없어 즉시 전환(뚝뚝 끊김).
- 클릭 후 새 페이지가 뜰 때까지 아무 피드백이 없음 — `loading.tsx` 0개, 링크 pending 표시 없음.
- 페이지 전환 연출 부재 — View Transitions 미사용, 화면이 확 바뀜.

## 방향 (사용자 확정)

- 톤: **절제된 프로덕션 톤** (150~250ms, 미묘한 lift·크로스페이드, Linear/Vercel 감).
- 접근: **CSS 정비 + View Transitions** — 새 런타임 의존성 없음, `experimental.viewTransition` 리스크 수용.

## 설계

### 1. 전역 인터랙션 레이어 (`app/globals.css` @layer base)

- 인터랙티브 요소(`a[href]`, `button`, `[role=button]`, `summary`)에 기본 transition
  (color·background-color·border-color·box-shadow·opacity·transform) — 기존 모션 토큰
  (`--default-transition-duration/-timing-function`) 사용. base 레이어 최하위라 astryx·유틸리티가 항상 이김
  → 산재한 hover 유틸은 **수정 없이** 부드러워짐.
- press 피드백: `:active { transform: scale(0.98) }` — 클릭 즉시 신호(터치 포함).
- `.card-interactive` hover 에 lift(`translateY(-1px)` + 은은한 shadow) 추가, `@media (hover: hover)` 가드.
- 기존 `prefers-reduced-motion` 블록 유지(transition 축소) + view-transition 애니메이션 제거 추가.

### 2. 클릭 즉시 피드백

- `loading.tsx` 2개: `(learner)/loading.tsx`(공통 콘텐츠 골격 — home·/me·provider 커버),
  `[provider]/[exam]/loading.tsx`(허브/스포크 골격). 스켈레톤은 `.skeleton` 펄스 블록, 헤더는 shell 이 유지.
- `PendingLink`(components/ui) — `useLinkStatus`(Next 16 내장)로 pending 동안 딤(지연 150ms) +
  코너 스피너(지연 300ms — 빠른 내비에선 안 보임). 적용: 홈 카탈로그·이어서 카드·내 문제함 카드,
  exam 허브 NavLink 타일, 컬렉션 목록 카드.
- 전역 프로그레스 바는 도입하지 않음(절제 톤, loading.tsx + pending 으로 충분).

### 3. 페이지 전환 (View Transitions)

- `next.config.mjs`: `experimental: { viewTransition: true }`.
- Next 16 번들 React canary(19.3.0-canary)가 `ViewTransition` 을 정식 export (npm react 19.2 타입엔 없음)
  → `components/PageTransition.tsx`(client)가 런타임 조회로 얻고 없으면 children 그대로(무애니 폴백).
- `(learner)/layout.tsx` 에서 `{children}` 만 래핑 — 헤더는 전환 밖(정적).
- CSS: `::view-transition-old/new(.vt-page)` 로 90ms 아웃 + 180ms 인(크로스페이드 + 4px 상승).
  `@supports (view-transition-name: root)` 가드. 방향성 슬라이드는 도입하지 않음.
- 롤백: 플래그 끄면 CSS·컴포넌트는 무해한 사문 — 나머지 기능 정상.

## 변경 파일

`app/globals.css`, `next.config.mjs`, `components/PageTransition.tsx`(신규),
`components/ui/PendingLink.tsx`(신규), `(learner)/loading.tsx`·`[exam]/loading.tsx`(신규),
`(learner)/layout.tsx`, `(learner)/page.tsx`, `components/views/Home.tsx`(NavLink),
`me/collections/page.tsx`. 기존 컴포넌트 스타일 수정 없음.

## 검증

- `next build && next start` prod-parity (dev 는 전환 타이밍 신뢰 불가).
- Chrome 실클릭: 홈 → provider → exam 허브 → quiz 왕복 + 뒤로가기 — 크로스페이드·스켈레톤·pending 확인.
- hover/press: 카드·버튼·헤더 링크 전환 부드러움, 터치 에뮬레이션 sticky hover 없음.
- `prefers-reduced-motion` 에뮬레이션 — 모션 전부 제거 확인.
- 회귀: 퀴즈 선택지 색 피드백, PDF 인쇄 영역, 포커스 링.
