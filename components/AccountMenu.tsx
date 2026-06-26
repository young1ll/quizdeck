"use client";

import { useState, type SubmitEvent } from "react";
import {
  signIn,
  signUp,
  signOut,
  useSession,
  sendVerificationEmail,
  requestPasswordReset,
} from "@/lib/auth-client";

// 계정 UI (이슈 #6 + ADR-0004): 가입·로그인·로그아웃 + 이메일 인증·비밀번호 재설정.
// 이메일 인증 필수 — 가입 후엔 세션 없이 "메일 확인" 안내, 미검증 로그인 시도엔 재발송 안내.
// 같은 오리진 쿠키 세션이라 새로고침·탭 재오픈에도 유지된다.

type Tab = "signin" | "signup";

// 서브경로 배포 대비 — 재설정/검증 콜백 URL prefix.
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

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

// 가입/로그인 후 전이되는 안내 상태 — 인증 메일 발송 / 재설정 메일 발송 / 미검증 로그인.
type Notice = { kind: "verifySent" | "resetSent" | "unverified"; email: string };

function AuthForms() {
  const [tab, setTab] = useState<Tab>("signin");
  const [forgot, setForgot] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [resent, setResent] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setForgot(false);
    setNotice(null);
    setResent(false);
    setError(null);
    setPassword("");
  };

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
      // 미검증 로그인 — 에러 대신 "메일 확인" 안내 + 재발송 경로.
      if (res.error.code === "EMAIL_NOT_VERIFIED") {
        setNotice({ kind: "unverified", email });
        return;
      }
      setError(res.error.message ?? "요청을 처리하지 못했습니다.");
      return;
    }
    setPassword("");
    // 가입 성공 — 검증 필수라 세션이 없다. "메일 확인" 안내로 전환.
    if (tab === "signup") setNotice({ kind: "verifySent", email });
    // 로그인 성공 — useSession 이 갱신되어 프로필 화면으로 전환된다.
  };

  const requestReset = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await requestPasswordReset({
      email,
      redirectTo: `${window.location.origin}${BASE_PATH}/reset-password`,
    });
    setBusy(false);
    if (res.error) {
      setError(res.error.message ?? "요청을 처리하지 못했습니다.");
      return;
    }
    setNotice({ kind: "resetSent", email });
  };

  const resend = async () => {
    setError(null);
    setBusy(true);
    const res = await sendVerificationEmail({ email, callbackURL: `${BASE_PATH}/` });
    setBusy(false);
    if (res.error) {
      setError(res.error.message ?? "재발송에 실패했습니다.");
      return;
    }
    setResent(true);
  };

  const shell = "w-full max-w-xs rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4";

  // ── 안내 화면 ──────────────────────────────────────────────
  if (notice) {
    const text =
      notice.kind === "resetSent"
        ? `비밀번호 재설정 링크를 ${notice.email}로 보냈습니다.`
        : `인증 메일을 ${notice.email}로 보냈습니다. 메일의 링크를 눌러 인증을 완료하세요.`;
    return (
      <div className={shell}>
        <p className="text-sm" role="status">
          ✉️ {text}
        </p>
        {notice.kind === "unverified" && (
          <button
            type="button"
            disabled={busy || resent}
            onClick={resend}
            className="mt-3 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-xs text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--fg)] disabled:opacity-50"
          >
            {busy ? "처리 중…" : resent ? "✓ 재발송했습니다" : "인증 메일 재발송"}
          </button>
        )}
        {error && (
          <p className="mt-2 text-xs text-[var(--bad)]" role="alert">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={reset}
          className="mt-2 w-full text-xs text-[var(--muted)] hover:text-[var(--fg)]"
        >
          ← 돌아가기
        </button>
      </div>
    );
  }

  // ── 비밀번호 찾기 화면 ─────────────────────────────────────
  if (forgot) {
    return (
      <form onSubmit={requestReset} className={shell}>
        <p className="mb-3 text-sm font-medium">비밀번호 재설정</p>
        <Field
          label="이메일"
          type="email"
          autoComplete="email"
          value={email}
          onChange={setEmail}
          placeholder="you@example.com"
        />
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
          {busy ? "처리 중…" : "재설정 메일 보내기"}
        </button>
        <button
          type="button"
          onClick={reset}
          className="mt-2 w-full text-xs text-[var(--muted)] hover:text-[var(--fg)]"
        >
          ← 로그인으로
        </button>
      </form>
    );
  }

  // ── 로그인 / 가입 ─────────────────────────────────────────
  return (
    <form onSubmit={submit} className={shell}>
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

      {tab === "signin" && (
        <button
          type="button"
          onClick={() => {
            setForgot(true);
            setError(null);
          }}
          className="mt-2 w-full text-xs text-[var(--muted)] hover:text-[var(--fg)]"
        >
          비밀번호를 잊으셨나요?
        </button>
      )}
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
