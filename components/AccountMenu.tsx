"use client";

import { useState } from "react";
import { signOut, useSession } from "@/lib/auth-client";
import AuthForms from "./AuthForms";

// 홈의 계정 UI (이슈 #6 + ADR-0004): 로그인 시 프로필, 아니면 인증 폼.
// 인증 폼 본체는 components/AuthForms.tsx — 연습 게이트 모달(이슈 #22)과 공유한다.

export default function AccountMenu() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <div className="text-xs text-[var(--muted)]" aria-live="polite">
        세션 확인 중…
      </div>
    );
  }

  if (session) {
    return <Profile name={session.user.name} email={session.user.email} />;
  }

  return <AuthForms />;
}

function Profile({ name, email }: { name?: string | null; email: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-[var(--muted)]">
        <span className="font-medium text-[var(--fg)]">{name?.trim() || email}</span> 님
      </span>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await signOut();
          setBusy(false);
        }}
        className="rounded-lg border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--fg)] disabled:opacity-50"
      >
        로그아웃
      </button>
    </div>
  );
}
