// 사이트 설정 (4단계 — WP 옵션으로 이관 완료). 설정 → QuizDeck(WP admin)에서 관리하고
// 공개 REST 로 읽는다. 어떤 실패(WP 미기동·구 플러그인·네트워크)에도 기본 문구로 폴백 —
// 사이트 셸이 설정 가용성에 인질 잡히지 않는다.

const WP_API_URL = process.env.WP_API_URL || "https://wp.myquizdeck.com";

export interface SiteConfigView {
  tagline: string;
  footerText: string;
  notice: { enabled: boolean; text: string; tone: "info" | "warning" };
}

const DEFAULTS: SiteConfigView = {
  tagline: "자격·기술 시험 대비 퀴즈 · 학습",
  footerText: "QuizDeck · self-hosted",
  notice: { enabled: false, text: "", tone: "info" },
};

export async function getSiteConfigCms(): Promise<SiteConfigView> {
  try {
    const res = await fetch(`${WP_API_URL}/wp-json/qd/v1/site-config`, {
      headers: { Host: "wp.myquizdeck.com" },
    });
    if (!res.ok) return DEFAULTS;
    const g = (await res.json()) as Partial<SiteConfigView> & { notice?: Partial<SiteConfigView["notice"]> };
    return {
      tagline: g.tagline || DEFAULTS.tagline,
      footerText: g.footerText || DEFAULTS.footerText,
      notice: {
        enabled: Boolean(g.notice?.enabled && g.notice?.text?.trim()),
        text: g.notice?.text ?? "",
        tone: g.notice?.tone === "warning" ? "warning" : "info",
      },
    };
  } catch {
    return DEFAULTS;
  }
}
