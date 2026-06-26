import { describe, it, expect, vi } from "vitest";
import {
  resolveEmailConfig,
  verificationEmail,
  resetPasswordEmail,
  sendEmail,
} from "./email";

describe("resolveEmailConfig — env 해석(순수)", () => {
  it("키·발신주소가 있으면 missing 없음", () => {
    const cfg = resolveEmailConfig({
      RESEND_API_KEY: "re_x",
      EMAIL_FROM: "QuizDeck <noreply@myquizdeck.com>",
    });
    expect(cfg).toEqual({
      apiKey: "re_x",
      from: "QuizDeck <noreply@myquizdeck.com>",
      missing: [],
    });
  });

  it("빈/공백 값은 미설정으로 보고한다", () => {
    const cfg = resolveEmailConfig({ RESEND_API_KEY: "  ", EMAIL_FROM: "" });
    expect(cfg.apiKey).toBeUndefined();
    expect(cfg.from).toBeUndefined();
    expect(cfg.missing).toEqual(["RESEND_API_KEY", "EMAIL_FROM"]);
  });
});

describe("이메일 템플릿(순수)", () => {
  it("검증 메일은 제목과 본문(html·text)에 링크를 담는다", () => {
    const url = "https://myquizdeck.com/api/auth/verify-email?token=abc";
    const m = verificationEmail(url);
    expect(m.subject).toMatch(/인증/);
    expect(m.html).toContain(url);
    expect(m.text).toContain(url);
  });

  it("재설정 메일은 제목과 본문에 링크를 담는다", () => {
    const url = "https://myquizdeck.com/reset-password?token=xyz";
    const m = resetPasswordEmail(url);
    expect(m.subject).toMatch(/재설정|비밀번호/);
    expect(m.html).toContain(url);
    expect(m.text).toContain(url);
  });
});

describe("sendEmail — Resend REST", () => {
  const msg = { to: "u@example.com", subject: "제목", html: "<p>h</p>", text: "h" };
  const env = { RESEND_API_KEY: "re_test", EMAIL_FROM: "QuizDeck <noreply@myquizdeck.com>" };

  it("설정되면 Resend /emails 로 from·to·subject·Authorization 을 POST 한다", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "e1" }), { status: 200 }));
    await sendEmail(msg, { env, fetch });

    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    expect(init.headers.authorization).toBe("Bearer re_test");
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      from: env.EMAIL_FROM,
      to: "u@example.com",
      subject: "제목",
      html: "<p>h</p>",
      text: "h",
    });
  });

  it("비ok 응답은 throw 한다", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("bad", { status: 422 }));
    await expect(sendEmail(msg, { env, fetch })).rejects.toThrow();
  });

  it("프로덕션에서 키 미설정이면 throw 한다", async () => {
    const fetch = vi.fn();
    await expect(
      sendEmail(msg, { env: { NODE_ENV: "production" }, fetch }),
    ).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("비프로덕션에서 키 미설정이면 발송을 건너뛴다(개발 폴백 — throw 없음, fetch 없음)", async () => {
    const fetch = vi.fn();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(sendEmail(msg, { env: { NODE_ENV: "test" }, fetch })).resolves.toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
