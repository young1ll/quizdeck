# 0014 — astryx 디자인 시스템 전면 도입: ADR-0008 무의존 대체, 빅뱅 마이그레이션

Status: accepted — 그릴링 2026-07-01 ([[0008-ui-interaction-and-components.md|ADR-0008]] 결정 2 대체 · 구현은 후속 빅뱅 브랜치)
> **애던덤 2026-07-07** (astryx↔Tailwind 캐스케이드 심(seam) — 아키텍처 리뷰, 브랜치 `refactor/astryx-tailwind-layers`): 아래 **결과**의 미결 항목 — *"통합 리스크(Phase 0 검증): astryx `@layer reset/astryx-base/astryx-theme` ↔ globals `@layer base`·Tailwind v4 레이어 **캐스케이드 순서**"* — 을 **astryx 공식 Tailwind 통합 채택으로 확정**한다. **근본 원인**: 과거 `@import "tailwindcss"` 는 `@layer theme, base, components, utilities` 를 **먼저** 선언 → 뒤이은 astryx import 의 `reset`/`astryx-base`/`astryx-theme` 레이어가 **utilities 뒤에 붙는다**. 레이어 순서가 특이도를 이기므로, astryx `reset.css` 의 **제로 특이도** `:where(*){border-width:0}`·`:where(h1..h6,p,ul…){margin:0}`·`:where(h1..h6){font-size/weight:inherit}` 가 Tailwind `.border`/`.mb-3`/`.text-sm`(utilities, 특이도 0,1,0)를 **이겨 죽였다** — border·margin·**heading 타이포**가 해당 요소에서 전부 무효. 그 누적 비용이 globals 의 **~50줄 재타겟 파일**(`.border{…!important}`·`html .mb-3{…!important}`·`.space-y-*>…`)이었고, 이 재타겟 자체가 CI Lightning CSS 의 **동일 셀렉터 dedup 함정**(로컬 빌드 통과·라이브만 죽음)을 안고 있었다. **결정**: astryx 공식 셋업 그대로 — `@layer reset, theme, base, astryx-base, astryx-theme, components, utilities;` **명시 선언**(utilities **마지막**) + Tailwind 를 `theme.css`(layer theme)·`preflight.css`(layer base)·`utilities.css`(layer utilities)로 **분리 import**, 그 사이에 astryx 3종. reset 이 `:where()` 제로 특이도라 **순서만 바로잡으면 utilities 가 깨끗이 이긴다 → 재타겟 파일 통째 삭제**(!important·html 접두어 소멸 → CI dedup 함정도 구조적 소거). **Bridge(`tailwind-theme.css`) 생략**: quizdeck 는 브랜드 토큰(`:root` + `@theme inline`, [[../../app/globals.css|globals.css]] SSOT)을 쓰고 astryx 시맨틱 이름(`bg-surface`…)을 안 써, Bridge 의 `--color-accent` 재정의가 브랜드 SSOT 와 **충돌**. **의도된 광역 결과**: heading 타이포가 이제 앱 **작성 클래스대로** 렌더(astryx 기본 h1=24·h2=20·600·흰색이 눌러 죽이던 `text-sm`/`font-*`/`text-[var(--muted)]` 가 복원 — eyebrow 헤딩이 20px 흰색→**14px muted**, 타이틀 weight 600→700; ~30개 헤딩, 개발자 의도 realize). **[[0008-ui-interaction-and-components.md|ADR-0008]] 결정 1 affordance floor(`@layer base`, 위 2026-07-03 애던덤 load-bearing)는 무영향** — `base` 는 두 순서 모두 astryx 레이어·utilities **앞**이라 관계 불변. **검증(3단)**: astryx 컴포넌트 갤러리 before/after(컴포넌트·강조 테두리 픽셀 무변화) + 주입 테스트(border 1px·mt/mb/space-y·emphasis 재타겟 없이 동작) + **로컬 standalone prod 빌드**(Lightning CSS parity 확인) + 라이브 주입. 순수 `@layer` 순서 기반이라 이전 prod-parity 실패(dedup)가 재발 불가.
>
> **애던덤 2026-07-03** (astryx UI 아키텍처 리뷰 A1–A4, 브랜치 `feat/ui-adapter-tests`): 아래 **결과**의 미결 항목 — *"전역 `@layer base` affordance 는 astryx `reset`/`astryx-base` 로 대체 검토"* — 을 **기각**하고 [[../../app/globals.css|globals.css]] affordance floor 를 **유지**한다. 근거(증거 기반): astryx `reset.css` 의 `cursor:pointer` 는 `:where(button, [role=button])`(특이도 0)뿐이라 `a[href]`·`summary` 를 안 깔고, `astryx.css` 의 `:focus-visible` 규칙은 **전부 StyleX 클래스 한정**(`.x…:focus-visible` = astryx 컴포넌트)이라 **네이티브 `button`·`a`·`input`·`summary`·`[tabindex]` 의 키보드 focus 링을 전역으로 주지 않는다**. 따라서 globals `@layer base`([[0008-ui-interaction-and-components.md|ADR-0008]] 결정 1)는 비-astryx 요소의 **focus a11y·`a`/`summary` cursor·disabled `not-allowed` 의 유일 출처**로 load-bearing이다 — astryx reset 과 **중복이 아니라 역할 분담**(globals=네이티브 요소, astryx=컴포넌트; 터치 focus 억제는 astryx reset 이 담당해 협력). `<Button>` 채택을 넓혀도 네이티브 링크(`<Link>`→`<a>`)·입력이 남아 floor 는 제거 불가. 재검토 불필요. (같은 리뷰의 다른 산출물: `components/ui/*` 어댑터 seam 테스트 · 브랜드 토큰 SSOT(var 참조) · `dangerOutline` 커스텀 astryx variant · Card 강조 테두리 복원.)

## 맥락

[[0008-ui-interaction-and-components.md|ADR-0008]] 결정 2가 **"컴포넌트는 직접 구축(무의존), 새 런타임
의존성(cva·Radix·shadcn) 없음"**을 채택했고, [[0013-desktop-logout.md|ADR-0013]]까지 "미리 사지 않음"으로
드롭다운조차 안 지었다. 그 결과 hand-rolled 컴포넌트 층([[../../components/ui/Button.tsx|Button]]·
[[../../components/ui/Field.tsx|Field]]·[[../../components/ui/Msg.tsx|Msg]]·StatTile·Container)이 동작·배포
중이나, **복잡 a11y 컴포넌트(메뉴·다이얼로그·팝오버·콤보박스)는 회피/고비용**으로 남았다.

새 변수: **[facebook/astryx](https://github.com/facebook/astryx)** — Meta 사내 8년 디자인 시스템
(13,000+ 앱, 사내 최대)을 오픈소스화(**Beta**). React + StyleX(소비자엔 **비가시** — 미리 빌드된 CSS +
타입드 React, 빌드 플러그인·PostCSS 없이 CSS 3개 import + theme provider), **150+ 접근성 컴포넌트**,
테마 = **CSS custom property 오버라이드**(`defineTheme`), swizzle(소스 eject), **"agent-ready"**(API·docs·
CLI를 사람·AI가 같은 방식으로). 이 레포는 **Claude Code 로 UI 를 짜는 워크플로**라 agent-ready 가 실제
레버다. (그릴링 2026-07-01)

## 결정

1. **astryx 전면 도입 — [[0008-ui-interaction-and-components.md|ADR-0008]] 결정 2(무의존)를 대체.**
   드라이버 = **에이전트 빌드 속도**(+호기심). 값의 핵심은 "버튼 빨리"가 아니다(에이전트는 단순 UI 는
   이미 빠름) — **에이전트가 회피해온 복잡 a11y 컴포넌트를 짤 수 있게 됨**이다.

2. **시각: 브랜드 + IA 유지, 컴포넌트 룩은 astryx.** quizdeck 토큰(`--accent`·`--bad`·`--good`·`--panel`
   …) → `defineTheme` 커스텀 테마로 매핑(brand-preserve). IA/UX 구조([[0010-learner-ui-architecture.md|ADR-0010]]·
   [[0012-learner-ia-audit.md|ADR-0012]] — 재개/회고 사다리·맥락 헤더·드릴다운)는 **조합·라우팅이라 유지**된다.
   현재 픽셀 룩 재현(전부 swizzle)은 도입 이득을 자멸시키므로 **하지 않는다** — 룩은 astryx 언어로 리디자인.

3. **빅뱅 마이그레이션.** 전용 브랜치 전면 재작성 → **전 면 Playwright 전량 검증** → **단일 원자 배포**.
   (점진 기각 — 사용자 선택. 빅뱅 리스크는 결정 5 가드레일로 상쇄.)

4. **스코프.** presentation 전부 → astryx: `components/ui/*` + 뷰들, 그리고 hand-rolled 특수 컴포넌트도
   astryx 등가로(**LoginModal → astryx Dialog · 계정 칩 → astryx Menu** — [[0013-desktop-logout.md|ADR-0013]]이
   포기한 드롭다운을 astryx 로 실현). **앱 로직은 유지** — 퀴즈 컨트롤러·phase, 주석 앵커링, ProgressStore,
   IA 라우팅/조합은 **뼈대 그대로, 시각 표현만 reskin**. **Tailwind v4 는 공존**(레이아웃) — 걷어내지 않음
   (스코프 폭증).

5. **Beta on prod 리스크 = 가드레일로 수용(타협 불가).** astryx 버전 **핀 고정** + `astryx upgrade --apply`
   코드모드로 버전 이동 + **롤백용 직전 이미지 sha** 확보 + **원자 배포 전 전량 검증**. Beta 컴포넌트
   버그/브레이킹이 라이브를 때리는 걸 이 게이트로 막는다.

## 왜

- **agent-ready** — API·docs·CLI 가 사람·AI 공용이라, Claude Code 가 같은 레퍼런스로 일관·접근성 있는
  UI 를 짠다. ADR-0008 작성 시엔 없던 이유.
- **150 a11y 컴포넌트** — [[0013-desktop-logout.md|ADR-0013]]이 포기한 드롭다운, [[0008-ui-interaction-and-components.md|ADR-0008]]
  이 슬라이스로 손수 깐 모달 focus-trap 등을 **무료로** → **회피 UI 해금**. 이게 도입의 진짜 값.
- **토큰 정합** — 테마 = CSS custom property 라 기존 `--accent` 토큰과 결이 같아 brand-preserve 저마찰.
- **빅뱅** — 사용자 선택. 단 전량 검증 + 원자 배포 + 롤백이 make-or-break.

## 고려한 대안 (재제안 방지)

- **무의존 유지([[0008-ui-interaction-and-components.md|ADR-0008]])** — agent-ready·복잡 a11y 컴포넌트 갈증엔
  미달. 대체됨.
- **점진 마이그레이션** — 라이브 + Beta 엔 더 안전하고 [[0012-learner-ia-audit.md|ADR-0012]] 슬라이스로 증명된
  패턴이나, 사용자가 빅뱅 선택. 가드레일(결정 5)로 리스크 상쇄.
- **픽셀 룩 재현(전부 swizzle/오버라이드)** — astryx 도입 이득(에이전트 속도·a11y·150 컴포넌트)을 스스로
  없애 hand-rolled 로 회귀. 브랜드만 유지.
- **spike 만 / 도입 보류** — 드라이버가 전면 지향이라 부족(사용자가 전면 선택).
- **Tailwind v4 제거** — 스코프 폭증. astryx 는 `className`(Tailwind) 오버라이드를 지원하므로 공존.

## 결과

- **[[0008-ui-interaction-and-components.md|ADR-0008]] 결정 2(무의존) 대체** — affordance floor·Button
  variant·모달 a11y 개념은 astryx 가 계승(전역 `@layer base` affordance 는 astryx `reset`/`astryx-base` 로
  대체 검토). ADR-0008 상단에 "결정 2는 ADR-0014로 대체" 애던덤 추가.
- **[[0009-icon-system.md|ADR-0009]](react-icons Lucide) 재조정** — astryx theme-neutral 도 **Lucide** 라
  정합. astryx 아이콘 채택 vs react-icons 유지는 Phase 0 에서 결정.
- **[[0013-desktop-logout.md|ADR-0013]] 뒤집힘(부분)** — 계정 메뉴를 astryx Menu 로 실현 가능. 단 "데스크톱
  반응형 로그아웃"이라는 **UX 결정**은 유지(구현이 Menu 로 바뀔 뿐).
- **[[0010-learner-ui-architecture.md|ADR-0010]]·[[0012-learner-ia-audit.md|ADR-0012]] IA 구조 유지**(조합/라우팅).
- **[[../../CONTEXT.md|CONTEXT.md]] 무변경** — 디자인 시스템은 기술 선택이지 도메인 글로서리가 아니다.
- **통합 리스크(Phase 0 검증)**: astryx `@layer reset/astryx-base/astryx-theme` ↔ 기존 [[../../app/globals.css|globals.css]]
  `@layer base`(affordance)·Tailwind v4 레이어 **캐스케이드 순서**; React 19 · Next 15 App Router 호환
  (README 상 no build plugin — OK 예상, Phase 0 에서 실증).
- **계획**: `.scratch/astryx-migration-plan.md` — Phase 0(통합·토큰→테마 매핑·레이어 검증) → 1(`ui/*`) →
  2(shell·헤더·계정 Menu·LoginModal Dialog) → 3(뷰: home·카탈로그·허브·/stats·/me·login) → 4(퀴즈·참조·
  내 문제함·주석) → 5(admin) → 6(전량 Playwright 검증 · 원자 배포 · 롤백 sha). **빅뱅 = 단일 배포지만 작업은
  phase 순으로** 진행·중간 검증.
