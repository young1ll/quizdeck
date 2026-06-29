// 공통 버튼 클래스 토큰 (ADR-0007 결정 1 · fast-follow #43). accent primary 제출 버튼 —
// AuthForms·MyPage·reset-password 가 공유한다. 과추상화 없이 클래스 상수로(버튼 props·여백은
// 각 호출부가 소유). AuthForms 는 폼 레이아웃상 앞에 mt-3 을 덧붙여 쓴다.

export const primaryButton =
  "w-full rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-[var(--accent-fg)] transition-opacity hover:opacity-90 disabled:opacity-50";
