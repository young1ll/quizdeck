"use client";

import { useState, type SubmitEvent } from "react";
import { useRouter } from "next/navigation";
import {
  changeEmail,
  changePassword,
  deleteUser,
  signOut,
  updateUser,
} from "@/lib/auth-client";
import { Field } from "@/components/ui/Field";
import { Msg } from "@/components/ui/Msg";
import { Button } from "@/components/ui/Button";
import { normalizeEmail } from "@/lib/format";

// 마이페이지 계정 관리 (이슈 #36/#38 / ADR-0006). 프로필(이름)·이메일 변경·보안(비번)·위험 구역(탈퇴).
// AuthForms 와 같은 폼 규약(Field·accent 버튼·--bad/--good·better-auth res.error)을 따른다.
// 레이아웃(main·헤더)과 활동 섹션(Dashboard, #37)은 app/me/page.tsx 가 소유 — 여기선 계정 섹션만.

const DELETE_PHRASE = "삭제합니다";

export default function MyPage({ name, email }: { name: string; email: string }) {
  return (
    <>
      <ProfileSection initialName={name} email={email} />
      <EmailSection />
      <PasswordSection />
      <DangerSection email={email} />
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

// ── 프로필 — 이름 수정 ────────────────────────────────────────
function ProfileSection({ initialName, email }: { initialName: string; email: string }) {
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const save = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setDone(false);
    setBusy(true);
    const res = await updateUser({ name: name.trim() });
    setBusy(false);
    if (res.error) {
      setError(res.error.message ?? "저장하지 못했습니다.");
      return;
    }
    setDone(true);
    // updateUser 후 better-auth 클라가 세션 스토어를 갱신한다(가입/로그인이 useSession 을
    // 갱신하는 것과 같은 경로) → 홈의 AccountMenu(useSession)가 다음 마운트에 새 이름을 반영.
  };

  return (
    <Section title="프로필">
      <form onSubmit={save} className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs text-[var(--muted)]">이메일</span>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2 text-sm text-[var(--muted)]">
            {email}
          </div>
        </label>
        <Field
          label="이름"
          autoComplete="name"
          value={name}
          onChange={(v) => {
            setName(v);
            setDone(false);
          }}
          placeholder="표시 이름"
          required={false}
        />
        {error && <Msg kind="bad">{error}</Msg>}
        {done && <Msg kind="good">저장되었습니다.</Msg>}
        <Button type="submit" variant="primary" fullWidth disabled={busy || name.trim() === initialName}>
          {busy ? "저장 중…" : "저장"}
        </Button>
      </form>
    </Section>
  );
}

// ── 이메일 변경 ───────────────────────────────────────────────
function EmailSection() {
  const [newEmail, setNewEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null); // pending — 인증 메일 보낸 새 주소

  const submit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    // 이메일 정규화 — 모바일 자동완성 앞뒤 공백/대문자 차단(AuthForms 와 같은 이유).
    const addr = normalizeEmail(newEmail);
    setBusy(true);
    const res = await changeEmail({ newEmail: addr, callbackURL: "/" });
    setBusy(false);
    if (res.error) {
      setError(res.error.message ?? "요청을 처리하지 못했습니다.");
      return;
    }
    setSent(addr);
    setNewEmail("");
  };

  return (
    <Section title="이메일 변경">
      {sent ? (
        <div className="space-y-2">
          <p className="text-sm text-[var(--muted)]" role="status">
            ✉️ <b className="text-[var(--fg)]">{sent}</b> 로 인증 메일을 보냈습니다. 메일의 링크를
            눌러 변경을 완료하세요. <b className="text-[var(--fg)]">완료 전까지 기존 이메일이 유지</b>
            됩니다.
          </p>
          <button
            type="button"
            onClick={() => setSent(null)}
            className="text-xs text-[var(--muted)] hover:text-[var(--fg)]"
          >
            ← 다른 주소로 다시
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <Field
            label="새 이메일"
            type="email"
            autoComplete="email"
            value={newEmail}
            onChange={setNewEmail}
            placeholder="new@example.com"
          />
          {error && <Msg kind="bad">{error}</Msg>}
          <Button type="submit" variant="primary" fullWidth disabled={busy || !newEmail.trim()}>
            {busy ? "보내는 중…" : "인증 메일 보내기"}
          </Button>
        </form>
      )}
    </Section>
  );
}

// ── 보안 — 비밀번호 변경 ──────────────────────────────────────
function PasswordSection() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setDone(false);
    setBusy(true);
    // 다른 기기 세션 폐기 — 비번 변경의 보안 의의(ADR-0006 결정 4).
    const res = await changePassword({
      currentPassword: current,
      newPassword: next,
      revokeOtherSessions: true,
    });
    setBusy(false);
    if (res.error) {
      setError(res.error.message ?? "변경하지 못했습니다.");
      return;
    }
    setDone(true);
    setCurrent("");
    setNext("");
  };

  return (
    <Section title="보안 — 비밀번호 변경">
      <form onSubmit={submit} className="space-y-3">
        <Field
          label="현재 비밀번호"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={setCurrent}
          placeholder="••••••••"
        />
        <Field
          label="새 비밀번호"
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={setNext}
          placeholder="••••••••"
          minLength={8}
        />
        {error && <Msg kind="bad">{error}</Msg>}
        {done && <Msg kind="good">비밀번호를 변경했습니다. 다른 기기는 로그아웃됩니다.</Msg>}
        <Button type="submit" variant="primary" fullWidth disabled={busy || !current || next.length < 8}>
          {busy ? "변경 중…" : "비밀번호 변경"}
        </Button>
      </form>
    </Section>
  );
}

// ── 위험 구역 — 회원 탈퇴 ─────────────────────────────────────
function DangerSection({ email }: { email: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canDelete = !!password && confirm.trim() === DELETE_PHRASE && !busy;

  const remove = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canDelete) return;
    setError(null);
    setBusy(true);
    const res = await deleteUser({ password });
    if (res.error) {
      setBusy(false);
      setError(res.error.message ?? "탈퇴하지 못했습니다.");
      return;
    }
    // user 행 삭제 → DB FK cascade 로 Progress·Annotation 정리됨. 세션은 이미 무효라 signOut 이
    // 실패해도(throw) 홈 이동은 진행한다.
    await signOut().catch(() => {});
    router.push("/");
  };

  return (
    <Section title="위험 구역">
      <p className="text-sm text-[var(--muted)]">
        회원 탈퇴 시 계정과 함께 <b className="text-[var(--fg)]">모든 학습 기록·주석</b>이 영구
        삭제됩니다. 되돌릴 수 없습니다.
      </p>
      {!open ? (
        <Button type="button" variant="dangerOutline" className="mt-3" onClick={() => setOpen(true)}>
          회원 탈퇴
        </Button>
      ) : (
        <form onSubmit={remove} className="mt-3 space-y-3 border-t border-[var(--border)] pt-3">
          <Field
            label="비밀번호 확인"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={setPassword}
            placeholder="••••••••"
          />
          <Field
            label={`확인을 위해 "${DELETE_PHRASE}" 를 입력하세요`}
            value={confirm}
            onChange={setConfirm}
            placeholder={DELETE_PHRASE}
            required={false}
          />
          {error && <Msg kind="bad">{error}</Msg>}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => {
                setOpen(false);
                setPassword("");
                setConfirm("");
                setError(null);
              }}
            >
              취소
            </Button>
            <Button type="submit" variant="danger" className="flex-1" disabled={!canDelete}>
              {busy ? "탈퇴 중…" : "영구 탈퇴"}
            </Button>
          </div>
          <p className="text-xs text-[var(--muted)]">{email} 계정이 삭제됩니다.</p>
        </form>
      )}
    </Section>
  );
}
