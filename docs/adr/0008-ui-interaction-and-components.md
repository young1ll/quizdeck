# 0008 — UI 상호작용·컴포넌트 확장: 전역 affordance 베이스 + 무의존 컴포넌트, 슬라이스로

Status: accepted

## 맥락

[[0007-shared-code-and-conventions.md|ADR-0007]]로 `components/ui/`(Field·Msg·StatTile)·평면 도메인 모듈을 세웠고 "2번째 중복에서 추출" 규약이 있다. 그러나 **상호작용 어포던스가 일관되지 않다.** Tailwind v4(`@import "tailwindcss"`) + CSS-var 토큰(`--accent`·`--bad`·`--good`·`--warn`·`--muted`·`--border`·`--panel`…) 위에서:

- **cursor**: `<button>` ~65개 중 `cursor-pointer`는 4곳뿐. Tailwind v4 preflight 는 버튼에 pointer 를 깔지 않아 **대부분 기본 커서**(화살표)다.
- **focus-visible**: 8개 파일만 일부 `focus:`/`focus-visible`. 다수 버튼이 **키보드 포커스 링이 없다**(a11y 갭).
- **disabled**: 6개 파일만 `disabled:` 스타일.
- **active(누름)**: 2개 파일만. 사실상 없음.
- 전역 CSS(`app/globals.css`)에 **상호작용 base 레이어가 없어** affordance 가 전부 요소별 유틸리티에 흩어져 있다.
- `primaryButton`(button.ts)은 **클래스 문자열 토큰일 뿐**, variant/size/state 를 가진 진짜 `<Button>`이 없다 — 매 버튼이 상호작용 클래스를 재기술하거나 누락한다.
- 고급으로 갈수록 **hand-rolled 모달/포털**([[../../components/LoginModal.tsx]]·주석 에디터 [[../../components/AnnotatableText.tsx]])의 a11y 갭(포커스 트랩·esc·복귀 포커스·aria-modal)이 커진다.

이 ADR은 "cursor-pointer 같은 기본 상호작용부터 고급까지" UI 컴포넌트를 **확장/개선**하는 방향과 슬라이스를 고정한다.

## 결정

1. **상호작용 어포던스의 floor 는 전역 base 레이어.** `app/globals.css` 의 `@layer base` 에 모든 interactive 요소(`button:not(:disabled)`·`[role="button"]`·`a[href]`·`summary`)에 `cursor: pointer`, `:disabled`/`[aria-disabled="true"]` 엔 `cursor: not-allowed`, `:focus-visible` 엔 outline 링(`2px solid var(--accent)`, offset `2px`)을 깐다. **한 번에 ~65개 버튼·링크를 무위험 교정.** 컴포넌트는 이 floor **위에** 얹는다(hybrid). `:focus-visible` 은 키보드 포커스 전용이라 마우스 클릭엔 안 뜨고, 기존 커스텀 포커스(Field 의 `focus:border-accent`)와 outline 은 공존한다.
2. **컴포넌트는 직접 구축(무의존).** 레포의 hand-rolled·minimal-deps·Tailwind v4·CSS-var 철학(`lib/email.ts`: "SDK 의존을 들이지 않는다 … 미리 사지 않음")을 유지한다. `<Button>` 등을 직접 작성, **새 런타임 의존성(cva·Radix·shadcn) 없음.** variant/size 는 무의존 class-map/prop-switch 로. 단 고급 a11y 프리미티브(Dialog focus-trap 등)는 직접 구현하되, **비용이 실제로 크면 그 프리미티브만 Radix 채택을 재고**(분리된 미래 결정).
3. **`<Button>` = variant · size · state.** variant: `primary`(accent)·`danger`(solid/outline `--bad`)·`ghost`(muted text)·`outline`(border). size: `sm`/`md`/`lg`. state: `disabled`(+base)·`loading`(고급). `primaryButton` 토큰은 `<Button variant="primary">`로 **흡수**된다.
4. **마이그레이션은 공존·기회주의적.** base 레이어가 affordance 를 이미 깔아 `<Button>` 채택의 목적은 "affordance 교정"이 아니라 **variant 일관성**이라 긴급도가 낮다. 65곳 빅뱅 대신 **"새 코드·건드리는 코드는 `<Button>`"** 규약(ADR-0007 '2번째 중복에서 추출'과 같은 결). 특수/일회성 버튼(Quiz 보기·주석 툴바)은 raw 로 둬도 된다.
5. **고급은 4개 슬라이스로.** (a) `<Button loading>` 스피너 + `aria-busy`(현재는 라벨을 "처리 중…"으로 스왑). (b) 모션/트랜지션 토큰(`@theme` duration/easing + `prefers-reduced-motion` 가드). (c) 모달 a11y — hand-rolled 모달·포털에 focus-trap·esc·복귀 포커스·`aria-modal`. (d) 확장 디자인 토큰 — radius/shadow/spacing/elevation 을 색상 토큰처럼 `@theme` 로 표준화.

## 왜

- **base 레이어 하나**가 65개 버튼의 cursor/focus/disabled 를 즉시·무위험 교정 — 가장 큰 ROI. 컴포넌트 마이그레이션을 기다리지 않는다.
- **무의존 직접 구축**은 레포 철학·번들·통제와 일치한다. cva/Radix 는 variant 폭증·a11y 비용이 **실제로** 커질 때의 재고 대상이지, 선제 도입 대상이 아니다.
- **공존 규약**은 base 레이어가 긴급도를 없앤 뒤라 빅뱅 마이그레이션의 고-churn·회귀 위험을 피한다.
- 고급을 4개로 쪼개면 각 슬라이스가 독립적으로 구현·검증 가능하고(로딩·모션·모달·토큰), "기본부터 고급까지"를 압박 없이 단계화한다.

## 고려한 대안 (재제안 방지)

- **컴포넌트 경유만(base 레이어 없음)** — raw 버튼이 마이그레이션 전까지 미교정. base floor 가 더 싸고 즉효. 기각.
- **shadcn/ui · Radix 채택** — 고급 a11y(Dialog·Popover·Tooltip)는 강하나 의존성·다른 관습(cn/cva·data-state) 유입, CSS-var 토큰 통합 비용. 레포 minimal-deps 철학과 충돌. (고급 a11y 비용이 실제로 크면 그 프리미티브만 재고 — 결정 2.)
- **cva / tailwind-variants** — variant 선언 표준이나 새 의존성. 현재 variant 수가 적어 무의존 class-map 으로 충분.
- **전면 마이그레이션(65곳)** — 완전 일관성이나 고-churn·회귀 위험·특수 버튼 억지 적용. base 레이어가 affordance 를 이미 깔아 한계 가치 낮음.
- **affordance 를 명시 유틸리티 토큰으로(`interactive` 클래스)** — 추적 가능하나 65곳 일일이 수정. 전역 base 가 더 싸다.

## 결과

- **Slice 1 — 상호작용 base 레이어**: `app/globals.css` `@layer base`. 시각 회귀 위험 낮음(`:focus-visible` outline 은 기존 border 포커스와 공존). 스크린샷/수동 확인.
- **Slice 2 — `<Button>` 컴포넌트**: `components/ui/Button.tsx`(variant/size/state, 무의존 class-map). `button.ts` 의 `primaryButton` 흡수, 호출부 기회주의 교체.
- **Slice 3a~3d — 고급**: `<Button loading>` · 모션 토큰 · 모달 focus-trap a11y · 확장 디자인 토큰.
- **규약**: "새 코드·건드리는 코드는 `<Button>`" + ADR-0007 '2번째 중복에서 추출' 참조. CONTEXT.md(순수 도메인 글로서리)엔 넣지 않는다.
- **후속 이슈**: 슬라이스별 5개 — base 레이어 · `<Button>` · (loading + 모션) · 모달 a11y · 확장 토큰.
