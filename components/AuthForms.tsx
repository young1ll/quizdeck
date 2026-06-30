"use client";

import { useState, type SubmitEvent } from "react";
import {
  signIn,
  signUp,
  sendVerificationEmail,
  requestPasswordReset,
} from "@/lib/auth-client";
import { SiGithub, SiGoogle, SiNaver } from "react-icons/si";
import { LuKeyRound, LuMail, LuCheck, LuArrowLeft } from "react-icons/lu";
import { Field } from "@/components/ui/Field";
import { Msg } from "@/components/ui/Msg";
import { Button } from "@/components/ui/Button";
import { normalizeEmail } from "@/lib/format";

// 인증 폼 (이슈 #6 + ADR-0004): 로그인·가입 + 이메일 인증·비밀번호 재설정.
// 이메일 인증 필수 — 가입 후엔 세션 없이 "메일 확인" 안내, 미검증 로그인 시도엔 재발송 안내.
// AccountMenu(홈)와 LoginModal(연습 게이트, 이슈 #22)이 공유한다.

type Tab = "signin" | "signup";

// 서브경로 배포 대비 — 재설정/검증 콜백 URL prefix.
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

// 가입/로그인 후 전이되는 안내 상태 — 인증 메일 발송 / 재설정 메일 발송 / 미검증 로그인.
type Notice = { kind: "verifySent" | "resetSent" | "unverified"; email: string };

export default function AuthForms() {
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

  // 제출 전 이메일 정규화 — better-auth lookup 은 소문자화하나 trim 은 안 한다(특히 비밀번호
  // 재설정 경로). 모바일 자동완성이 붙이는 앞뒤 공백이 "User not found" 를 유발하므로 차단.
  const cleanEmail = () => normalizeEmail(email);

  const submit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const addr = cleanEmail();
    setError(null);
    setBusy(true);
    const res =
      tab === "signup"
        ? await signUp.email({ email: addr, password, name: name.trim() || addr })
        : await signIn.email({ email: addr, password });
    setBusy(false);

    if (res.error) {
      // 미검증 로그인 — 에러 대신 "메일 확인" 안내 + 재발송 경로.
      if (res.error.code === "EMAIL_NOT_VERIFIED") {
        setNotice({ kind: "unverified", email: addr });
        return;
      }
      setError(res.error.message ?? "요청을 처리하지 못했습니다.");
      return;
    }
    setPassword("");
    // 가입 성공 — 검증 필수라 세션이 없다. "메일 확인" 안내로 전환.
    if (tab === "signup") setNotice({ kind: "verifySent", email: addr });
    // 로그인 성공 — useSession 이 갱신되어 호출부(프로필/모달)가 전환된다.
  };

  const requestReset = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const addr = cleanEmail();
    setError(null);
    setBusy(true);
    const res = await requestPasswordReset({
      email: addr,
      redirectTo: `${window.location.origin}${BASE_PATH}/reset-password`,
    });
    setBusy(false);
    if (res.error) {
      setError(res.error.message ?? "요청을 처리하지 못했습니다.");
      return;
    }
    setNotice({ kind: "resetSent", email: addr });
  };

  const resend = async () => {
    setError(null);
    setBusy(true);
    const res = await sendVerificationEmail({ email: cleanEmail(), callbackURL: `${BASE_PATH}/` });
    setBusy(false);
    if (res.error) {
      setError(res.error.message ?? "재발송에 실패했습니다.");
      return;
    }
    setResent(true);
  };

  // 패스키(WebAuthn) 로그인 — 비밀번호 없이(이슈 #10). 같은 오리진에서 등록한 패스키로 인증한다.
  // 성공 시 better-auth 가 세션을 세워 useSession 이 갱신되고 호출부(모달/홈)가 전환된다. 플러그인은
  // 프롬프트 취소를 throw 가 아니라 res.error(영어 메시지)로 돌려주므로 에러는 한국어로 통일한다.
  // try/catch 는 throw 하는 버전 대비 안전망(이메일/비번 입력 없이 동작).
  const signInPasskey = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await signIn.passkey();
      // 취소(등록 패스키 없음 포함)/실패 모두 한국어로 — 라이브러리 영어 문구를 노출하지 않는다.
      if (res?.error) setError("패스키 로그인이 취소되었거나 등록된 패스키가 없습니다.");
    } catch {
      setError("패스키 로그인이 취소되었거나 등록된 패스키가 없습니다.");
    } finally {
      setBusy(false);
    }
  };

  // 소셜 로그인(V4, 이슈 #9) — 익숙한 계정으로 비밀번호 없이 Learner 가 된다. 성공 시 better-auth 가
  // 외부 provider 로 리다이렉트했다가 콜백으로 돌아와 세션을 세우고 callbackURL(홈)로 보낸다 →
  // useSession 갱신. 자격증명 미주입(미등록) provider 는 res.error 로 와서 한국어로 안내한다.
  // GitHub·Google 은 built-in signIn.social, Naver 는 generic OAuth signIn.oauth2.
  // 성공 시 provider 로 리다이렉트되어 사실상 반환하지 않는다. res.error 는 미등록·실패 →
  // 한국어로 안내. throw 는 client 규약상 드물지만 finally 로 busy 고착을 막는다(패스키 핸들러와 동일).
  const SOCIAL_FAIL = "이 로그인 수단을 지금 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.";
  const socialSignIn = async (provider: "github" | "google") => {
    setError(null);
    setBusy(true);
    try {
      const res = await signIn.social({ provider, callbackURL: `${BASE_PATH}/` });
      if (res?.error) setError(SOCIAL_FAIL);
    } catch {
      setError(SOCIAL_FAIL);
    } finally {
      setBusy(false);
    }
  };
  const naverSignIn = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await signIn.oauth2({ providerId: "naver", callbackURL: `${BASE_PATH}/` });
      if (res?.error) setError(SOCIAL_FAIL);
    } catch {
      setError(SOCIAL_FAIL);
    } finally {
      setBusy(false);
    }
  };

  const shell = "w-full max-w-xs rounded-card border border-[var(--border)] bg-[var(--panel)] p-4";

  // ── 안내 화면 ──────────────────────────────────────────────
  if (notice) {
    const text =
      notice.kind === "resetSent"
        ? `비밀번호 재설정 링크를 ${notice.email}로 보냈습니다.`
        : `인증 메일을 ${notice.email}로 보냈습니다. 메일의 링크를 눌러 인증을 완료하세요.`;
    return (
      <div className={shell}>
        <p className="flex items-start gap-2 text-sm" role="status">
          <LuMail className="mt-0.5 size-4 shrink-0 text-[var(--muted)]" aria-hidden />
          <span>{text}</span>
        </p>
        {notice.kind === "unverified" && (
          <button
            type="button"
            disabled={busy || resent}
            onClick={resend}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-xs text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--fg)] disabled:opacity-50"
          >
            {busy ? (
              "처리 중…"
            ) : resent ? (
              <>
                <LuCheck className="size-3.5 text-[var(--good)]" aria-hidden /> 재발송했습니다
              </>
            ) : (
              "인증 메일 재발송"
            )}
          </button>
        )}
        {error && (
          <Msg kind="bad" className="mt-2">
            {error}
          </Msg>
        )}
        <button
          type="button"
          onClick={reset}
          className="mt-2 flex w-full items-center justify-center gap-1 text-xs text-[var(--muted)] hover:text-[var(--fg)]"
        >
          <LuArrowLeft className="size-3.5" aria-hidden /> 돌아가기
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
          <Msg kind="bad" className="mt-2">
            {error}
          </Msg>
        )}
        <Button type="submit" variant="primary" fullWidth loading={busy} className="mt-3">
          재설정 메일 보내기
        </Button>
        <button
          type="button"
          onClick={reset}
          className="mt-2 flex w-full items-center justify-center gap-1 text-xs text-[var(--muted)] hover:text-[var(--fg)]"
        >
          <LuArrowLeft className="size-3.5" aria-hidden /> 로그인으로
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

      <Button type="submit" variant="primary" fullWidth loading={busy} className="mt-3">
        {tab === "signup" ? "가입하기" : "로그인"}
      </Button>

      {/* 소셜 로그인(#9) — 양 탭 공통(소셜은 가입도 겸함). 미등록 provider 는 클릭 시 한국어 안내. */}
      <div className="my-3 flex items-center gap-2 text-[10px] text-[var(--muted)]">
        <span className="h-px flex-1 bg-[var(--border)]" />
        또는
        <span className="h-px flex-1 bg-[var(--border)]" />
      </div>
      <div className="space-y-2">
        <IconButton
          icon={<SiGithub className="size-[18px]" />}
          label="GitHub 계정으로 계속"
          disabled={busy}
          onClick={() => socialSignIn("github")}
        />
        <IconButton
          icon={<SiGoogle className="size-[18px]" />}
          label="Google 계정으로 계속"
          disabled={busy}
          onClick={() => socialSignIn("google")}
        />
        <IconButton
          icon={<SiNaver className="size-[15px]" style={{ color: "#03C75A" }} />}
          label="네이버 계정으로 계속"
          disabled={busy}
          onClick={naverSignIn}
        />
      </div>

      {tab === "signin" && (
        <>
          <IconButton
            icon={<LuKeyRound className="size-4" />}
            label="패스키로 로그인"
            disabled={busy}
            onClick={signInPasskey}
            className="mt-2"
          />
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
        </>
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

// 아이콘 버튼(ADR-0009 파일럿) — 공통 Button(outline) + 왼쪽 고정 아이콘 + 중앙 라벨.
// 아이콘은 absolute left 라 세 버튼 라벨 정렬이 흐트러지지 않는다. 소셜·패스키 버튼이 공유.
// 아이콘은 장식이라 호출부에서 aria-hidden 없이도 라벨이 의미를 전한다(여기선 텍스트 라벨 동반).
function IconButton({
  icon,
  label,
  onClick,
  disabled,
  className = "",
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      fullWidth
      disabled={disabled}
      onClick={onClick}
      className={`relative${className ? " " + className : ""}`}
    >
      <span aria-hidden className="absolute left-3 flex items-center">
        {icon}
      </span>
      {label}
    </Button>
  );
}
