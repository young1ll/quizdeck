# 0013 — 로그아웃: 데스크톱 상시 노출(반응형), 드롭다운 아님

Status: accepted — 그릴링 2026-07-01 ([[0012-learner-ia-audit.md|ADR-0012]] 애던덤)

## 맥락

[[0012-learner-ia-audit.md|ADR-0012]] 슬라이스 A 가 계정 관리를 `/me` → `/me/account` 로 격리하면서
로그아웃이 **3-hop**(헤더 이름 → `/me` → `계정 관리` → 로그아웃)으로 깊어졌다(`signOut` 은
[[../../components/MyPage.tsx|MyPage]] 한 곳). 모바일은 로그인 유지가 정상이라 이 깊이가 무방하나,
**데스크톱/웹에선 로그아웃을 찾기 쉬워야** 한다는 요구. (그릴링 2026-07-01)

## 결정

헤더 이름 옆에 **데스크톱(`sm:` ≥640px)만 상시 로그아웃**을 노출(`hidden sm:inline-flex`), 모바일은
현행 유지(로그아웃은 `/me/account` 로 깊게). [[../../components/AccountChip.tsx|AccountChip]] 안에 얹어
default·exam 맥락 헤더([[0012-learner-ia-audit.md|ADR-0012]] C1) **양쪽에 일관** 노출. `signOut()` → `/`
full reload(MyPage 와 같은 경로). 확인 모달 없음(비파괴 — 다시 로그인하면 됨).

## 왜

- 요구가 "웹에서 로그아웃 **찾기 쉬움**"이라 **상시 노출**이 드롭다운(클릭 뒤 숨김)보다 발견성이 높다.
- 모바일 `hidden` 이라 [[0010-learner-ui-architecture.md|ADR-0010]] mobile-first·미니멀 불변, 이름→`/me`
  1-탭도 그대로.

## 고려한 대안 (재제안 방지)

- **헤더 이름 드롭다운(계정 메뉴: 마이페이지·계정·어드민·로그아웃)** — 데스크톱 관습이나 (1) 로그아웃을
  클릭 뒤로 숨겨 "찾기 쉬움" 요구에 **역행**, (2) 메뉴 프리미티브(focus-trap·esc·click-outside·roving
  tabindex·복귀 포커스)를 무의존으로 신설하는 a11y 비용, (3) [[0008-ui-interaction-and-components.md|ADR-0008]]
  (메뉴 a11y·"미리 사지 않음")·[[0010-learner-ui-architecture.md|ADR-0010]](홈 AccountMenu 제거)·
  [[0012-learner-ia-audit.md|ADR-0012]] 결정 10 에서 **이미 세 번 기각**. 상시 노출이 요구에 더 맞다 —
  **네 번째 재제안 방지.**
- **`/me` 인덱스에 로그아웃 복원** — 깊이만 1홉 줄이나 여전히 `/me` 경유라 데스크톱 발견성 요구엔 미달.

## 결과

- [[../../CONTEXT.md|CONTEXT.md]] 무변경 — auth 세션 로그아웃은 도메인 [[../../CONTEXT.md#Session|Session]]
  (진행 중 퀴즈 시도)과 **다른 축**이고, 헤더·로그아웃은 UI 아키텍처 용어이지 도메인 글로서리가 아니다.
- [[../../components/AccountChip.tsx|AccountChip]] 에 데스크톱 로그아웃 추가. `/me/account` 로그아웃 섹션은
  **모바일 canonical** 로 유지(헤더 것은 데스크톱 단축).
