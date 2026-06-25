"use client";

import { useState, type SubmitEvent } from "react";
import { signIn, signUp, signOut, useSession } from "@/lib/auth-client";

// 최소 계정 UI (이슈 #6): 가입·로그인·로그아웃 + 현재 Learner 프로필 표시.
// 익명 사용은 그대로 — 로그인은 선택지일 뿐이라 어떤 기능도 게이팅하지 않는다.
// Progress 동기화는 아직 없다(V2). 같은 오리진 쿠키 세션이라 새로고침·탭 재오픈에도 유지된다.

type Tab = "signin" | "signup";

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

function AuthForms() {
  const [tab, setTab] = useState<Tab>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res =
      tab === "signup"
        ? await signUp.email({ email, password, name: name.trim() || email })
        : await signIn.email({ email, password });
    setBusy(false);
    if (res.error) {
      setError(res.error.message ?? "요청을 처리하지 못했습니다.");
      return;
    }
    // 성공 — useSession 이 갱신되어 프로필 화면으로 전환된다.
    setPassword("");
  };

  return (
    <form
      onSubmit={submit}
      className="w-full max-w-xs rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4"
    >
      <div className="mb-3 flex gap-1 text-xs">
        <TabButton active={tab === "signin"} onClick={() => setTab("signin")}>
          로그인
        </TabButton>
        <TabButton active={tab === "signup"} onClick={() => setTab("signup")}>
          가입
        </TabButton>
      </div>

      <div className="space-y-2">
        {tab === "signup" && (
          <Field
            label="이름"
            type="text"
            autoComplete="name"
            value={name}
            onChange={setName}
            placeholder="표시 이름 (선택)"
            required={false}
          />
        )}
        <Field
          label="이메일"
          type="email"
          autoComplete="email"
          value={email}
          onChange={setEmail}
          placeholder="you@example.com"
        />
        <Field
          label="비밀번호"
          type="password"
          autoComplete={tab === "signup" ? "new-password" : "current-password"}
          value={password}
          onChange={setPassword}
          placeholder="••••••••"
          minLength={8}
        />
      </div>

      {error && (
        <p className="mt-2 text-xs text-[var(--bad)]" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="mt-3 w-full rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-[var(--accent-fg)] transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "처리 중…" : tab === "signup" ? "가입하기" : "로그인"}
      </button>
    </form>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-lg px-3 py-1 font-medium transition-colors " +
        (active
          ? "bg-[var(--accent)] text-[var(--accent-fg)]"
          : "text-[var(--muted)] hover:text-[var(--fg)]")
      }
    >
      {children}
    </button>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
  required = true,
  minLength,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-[var(--muted)]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--fg)] outline-none focus:border-[var(--accent)]"
      />
    </label>
  );
}
