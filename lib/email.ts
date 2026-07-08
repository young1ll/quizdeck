// 트랜잭션 이메일 sender (서버 전용) — Resend REST API 직접 호출 (이슈 #21 / ADR-0004).
//
// SDK 의존을 들이지 않는다(얇은 sender엔 fetch로 충분, "미리 사지 않음"). 검증·재설정
// 메일을 보낸다. 시크릿(RESEND_API_KEY)·발신주소(EMAIL_FROM)는 git 밖 — 프로덕션은 k8s
// Secret/env로 주입한다([[k8s/base/README.md]]). 빌드 시점(env 없음)엔 import만으론 아무 일도
// 안 일어난다 — 해석/발송은 호출 시점에만.

import { log } from "./log";

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const APP = "QuizDeck";

export interface EmailEnvInput {
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  NODE_ENV?: string;
  [key: string]: string | undefined;
}

export interface ResolvedEmailConfig {
  /** Resend API 키. */
  apiKey?: string;
  /** 발신주소(`이름 <addr>` 형식 허용). */
  from?: string;
  /** 발송에 필수인데 비어 있는 키들. */
  missing: string[];
}

/** 보낼 한 통의 메일. 템플릿(verificationEmail 등)이 to를 뺀 나머지를 만든다. */
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

function nonEmpty(v: string | undefined): string | undefined {
  const t = v?.trim();
  return t ? t : undefined;
}

/** 순수 env 해석 — DB·네트워크 무접촉, throw 없음(auth-config와 같은 규약). */
export function resolveEmailConfig(env: EmailEnvInput): ResolvedEmailConfig {
  const apiKey = nonEmpty(env.RESEND_API_KEY);
  const from = nonEmpty(env.EMAIL_FROM);
  const missing: string[] = [];
  if (!apiKey) missing.push("RESEND_API_KEY");
  if (!from) missing.push("EMAIL_FROM");
  return { apiKey, from, missing };
}

// ── 템플릿(순수) ─────────────────────────────────────────────
// 가입 검증과 이메일 변경(이슈 #38)이 공유하는 템플릿 — 문구는 둘 다에 자연스럽게 중립적으로.
// (better-auth 의 change-email 은 verified 사용자일 때 이 sendVerificationEmail 콜백을 재사용해
//  새 주소로 링크를 보낸다 — 클릭 시 이메일이 교체된다.)
export function verificationEmail(url: string): Omit<EmailMessage, "to"> {
  return {
    subject: `${APP} 이메일 인증`,
    html:
      `<p>${APP} 에서 이 이메일 주소를 인증하려면 아래 링크를 누르세요.</p>` +
      `<p><a href="${url}">이메일 인증하기</a></p>` +
      `<p>본인이 요청하지 않았다면 이 메일을 무시하세요.</p>`,
    text: `${APP} 이메일 인증: ${url}`,
  };
}

export function resetPasswordEmail(url: string): Omit<EmailMessage, "to"> {
  return {
    subject: `${APP} 비밀번호 재설정`,
    html:
      `<p>비밀번호를 재설정하려면 아래 링크를 누르세요.</p>` +
      `<p><a href="${url}">비밀번호 재설정</a></p>` +
      `<p>본인이 요청하지 않았다면 이 메일을 무시하세요.</p>`,
    text: `${APP} 비밀번호 재설정: ${url}`,
  };
}

/**
 * 한 통을 발송한다. Resend REST(POST /emails)로 보낸다.
 * 키 미설정 시: 프로덕션(NODE_ENV=production, Dockerfile 이 설정)은 명백한 오류 → throw.
 * 비프로덕션(로컬/테스트)은 발송을 건너뛰고 콘솔에 링크를 노출 — 로컬에서 인증·재설정
 * 흐름이 SMTP 없이도 막히지 않게 한다.
 */
export async function sendEmail(
  msg: EmailMessage,
  deps: { env?: EmailEnvInput; fetch?: typeof fetch } = {},
): Promise<void> {
  const env = deps.env ?? (process.env as EmailEnvInput);
  const doFetch = deps.fetch ?? globalThis.fetch.bind(globalThis);
  const cfg = resolveEmailConfig(env);

  if (cfg.missing.length > 0) {
    if (env.NODE_ENV === "production") {
      throw new Error(`[email] 누락된 환경변수: ${cfg.missing.join(", ")}`);
    }
    log.warn("email dev 발송 건너뜀", {
      missing: cfg.missing,
      to: msg.to,
      subject: msg.subject,
      text: msg.text,
    });
    return;
  }

  const res = await doFetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      authorization: `Bearer ${cfg.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: cfg.from,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
    }),
  });
  if (!res.ok) {
    throw new Error(`[email] Resend 발송 실패: ${res.status} ${await res.text().catch(() => "")}`);
  }
}
