"use client";

import { useEffect, useState, type SubmitEvent } from "react";
import Link from "next/link";
import { resetPassword } from "@/lib/auth-client";
import { Field } from "@/components/ui/Field";
import { Msg } from "@/components/ui/Msg";

// 비밀번호 재설정 랜딩 (이슈 #21 / ADR-0004).
// 재설정 메일 링크 → better-auth 서버 콜백이 토큰을 검증하고 이 페이지로 리다이렉트한다:
//  - 유효: ?token=VALID  → 새 비밀번호 폼
//  - 무효/만료: ?error=INVALID_TOKEN → 안내
// 쿼리는 클라이언트에서 직접 읽어 useSearchParams 의 Suspense 요구를 피한다.

export default function ResetPasswordPage() {
  const [token, setToken] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("error")) setInvalid(true);
    else setToken(q.get("token"));
  }, []);

  const submit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!token) return;
    setError(null);
    setBusy(true);
    const res = await resetPassword({ newPassword: password, token });
    setBusy(false);
    if (res.error) {
      setError(res.error.message ?? "재설정에 실패했습니다. 링크가 만료되었을 수 있습니다.");
      return;
    }
    setDone(true);
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-12">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-6">
        <h1 className="text-lg font-bold">비밀번호 재설정</h1>

        {invalid ? (
          <>
            <p className="mt-3 text-sm text-[var(--muted)]">
              링크가 만료되었거나 올바르지 않습니다. 다시 요청해 주세요.
            </p>
            <HomeLink />
          </>
        ) : done ? (
          <>
            <p className="mt-3 text-sm" role="status">
              ✅ 비밀번호가 변경되었습니다. 새 비밀번호로 로그인하세요.
            </p>
            <HomeLink label="로그인하러 가기" />
          </>
        ) : (
          <form onSubmit={submit} className="mt-4 space-y-3">
            <Field
              label="새 비밀번호"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={setPassword}
              placeholder="••••••••"
              minLength={8}
              disabled={!token}
            />

            {error && <Msg kind="bad">{error}</Msg>}

            <button
              type="submit"
              disabled={busy || !token}
              className="w-full rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-[var(--accent-fg)] transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "처리 중…" : token ? "비밀번호 변경" : "링크 확인 중…"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

function HomeLink({ label = "← 홈으로" }: { label?: string }) {
  return (
    <Link
      href="/"
      className="mt-4 inline-block text-sm text-[var(--accent)] hover:underline"
    >
      {label}
    </Link>
  );
}
