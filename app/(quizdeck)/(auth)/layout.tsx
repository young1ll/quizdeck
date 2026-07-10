// (auth) 섹션 — 집중 chrome(헤더 없음, 중앙 정렬, safe-area). reset-password 와 (슬라이스 C)/login 이
// 공유한다. mobile-first 풀스크린 — 산만한 네비 없이 인증 한 가지에 집중(ADR-0010 결정 2·3).
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">{children}</div>
  );
}
