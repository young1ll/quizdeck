"use client";

import { useCallback, useEffect, useState, type SubmitEvent } from "react";
import { useRouter } from "next/navigation";
import {
  changeEmail,
  changePassword,
  deleteUser,
  passkey,
  signOut,
  updateUser,
} from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-error";
import { LuMail, LuKeyRound } from "react-icons/lu";
import { Card } from "@astryxdesign/core/Card";
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
      <PasskeySection />
      <LogoutSection />
      <DangerSection email={email} />
    </>
  );
}

// ── 로그아웃 ──────────────────────────────────────────────────
// home 헤더의 로그인/마이페이지 칩 외, 계정 허브(/me)가 로그아웃을 소유한다(ADR-0010 슬라이스 C —
// home AccountMenu 제거). signOut 후 full reload 로 home — 세션·캐시를 깨끗이 비운다.
function LogoutSection() {
  const [busy, setBusy] = useState(false);
  return (
    <Section title="세션">
      <Button
        variant="outline"
        loading={busy}
        onClick={async () => {
          setBusy(true);
          await signOut().catch(() => {});
          window.location.href = "/";
        }}
      >
        로그아웃
      </Button>
    </Section>
  );
}

// 계정 섹션 서피스 — astryx Card (ADR-0014 Phase 3). 6개 섹션 공통. 폼(Field·Msg·Button)은 이미 astryx.
// 섹션 간 간격은 부모(account/page.tsx `space-y-5`)가 제공.
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card padding={5}>
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {children}
    </Card>
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
    const err = authErrorMessage(res, "저장하지 못했습니다.");
    if (err) {
      setError(err);
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
        <Button type="submit" variant="primary" fullWidth loading={busy} disabled={name.trim() === initialName}>
          저장
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
    const err = authErrorMessage(res, "요청을 처리하지 못했습니다.");
    if (err) {
      setError(err);
      return;
    }
    setSent(addr);
    setNewEmail("");
  };

  return (
    <Section title="이메일 변경">
      {sent ? (
        <div className="space-y-2">
          <p className="flex gap-2 text-sm text-[var(--muted)]" role="status">
            <LuMail className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              <b className="text-[var(--fg)]">{sent}</b> 로 인증 메일을 보냈습니다. 메일의 링크를
              눌러 변경을 완료하세요. <b className="text-[var(--fg)]">완료 전까지 기존 이메일이 유지</b>
              됩니다.
            </span>
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
          <Button type="submit" variant="primary" fullWidth loading={busy} disabled={!newEmail.trim()}>
            인증 메일 보내기
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
    const err = authErrorMessage(res, "변경하지 못했습니다.");
    if (err) {
      setError(err);
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
        <Button type="submit" variant="primary" fullWidth loading={busy} disabled={!current || next.length < 8}>
          비밀번호 변경
        </Button>
      </form>
    </Section>
  );
}

// ── 보안 — 패스키(WebAuthn) ───────────────────────────────────
// 로그인한 Learner 가 기기 생체인증·보안키를 비밀번호 없는 로그인 수단으로 등록·관리한다(이슈 #10).
// 등록/인증은 같은 오리진(myquizdeck.com)에서 — 외부 IdP·OAuth 등록 없음. 로그인은 AuthForms 의
// "패스키로 로그인". 플러그인은 프롬프트 취소를 throw 가 아니라 res.error(영어 메시지)로 돌려주므로
// 에러는 한국어로 통일해 노출한다(라이브러리 영어 문구를 그대로 보이지 않게). try/catch 는 throw
// 하는 버전 대비 안전망.
type PasskeyItem = { id: string; name?: string | null; createdAt: string | Date };

function PasskeySection() {
  const [list, setList] = useState<PasskeyItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await passkey.listUserPasskeys();
      if (!res.error) setList(res.data ?? []);
    } catch {
      /* 목록 조회 실패는 조용히 — 등록/삭제 액션에서만 에러를 노출 */
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const add = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await passkey.addPasskey();
      // 취소/실패 모두 res.error(영어)로 온다 — 라이브러리 문구 대신 한국어로 통일.
      if (res?.error) {
        setError("패스키 등록이 취소되었거나 실패했습니다.");
        return;
      }
      await refresh();
    } catch {
      // 일부 버전은 프롬프트 취소를 throw — 같은 한국어 메시지로 처리.
      setError("패스키 등록이 취소되었거나 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setError(null);
    const res = await passkey.deletePasskey({ id });
    if (res.error) {
      setError("패스키를 삭제하지 못했습니다.");
      return;
    }
    await refresh();
  };

  return (
    <Section title="보안 — 패스키">
      <p className="text-sm text-[var(--muted)]">
        기기 생체인증(지문·얼굴)이나 보안키로 <b className="text-[var(--fg)]">비밀번호 없이</b>
        로그인합니다. 등록한 기기에서 만들어 두세요.
      </p>
      {list && list.length > 0 && (
        <ul className="mt-3 space-y-2">
          {list.map((pk) => (
            <li
              key={pk.id}
              className="flex items-center justify-between rounded-control border border-[var(--border)] px-3 py-2 text-sm"
            >
              <span className="inline-flex items-center gap-1.5">
                <LuKeyRound className="size-3.5 shrink-0" aria-hidden /> {pk.name || "패스키"}{" "}
                <span className="text-xs text-[var(--muted)]">
                  · {new Date(pk.createdAt).toLocaleDateString("ko-KR")}
                </span>
              </span>
              <button
                type="button"
                onClick={() => remove(pk.id)}
                className="text-xs text-[var(--muted)] hover:text-[var(--bad)]"
              >
                삭제
              </button>
            </li>
          ))}
        </ul>
      )}
      {list && list.length === 0 && (
        <p className="mt-3 text-xs text-[var(--muted)]">등록된 패스키가 없습니다.</p>
      )}
      {error && <Msg kind="bad" className="mt-2">{error}</Msg>}
      <Button type="button" variant="outline" loading={busy} onClick={add} className="mt-3">
        패스키 등록
      </Button>
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
    const err = authErrorMessage(res, "탈퇴하지 못했습니다.");
    if (err) {
      setBusy(false);
      setError(err);
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
            <Button type="submit" variant="danger" className="flex-1" loading={busy} disabled={!canDelete}>
              영구 탈퇴
            </Button>
          </div>
          <p className="text-xs text-[var(--muted)]">{email} 계정이 삭제됩니다.</p>
        </form>
      )}
    </Section>
  );
}
