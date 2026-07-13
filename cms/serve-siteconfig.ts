import { getPayload } from "payload";
import config from "@payload-config";

// 사이트 설정 (임시 — payload Global 잔존분). 3단계 서빙 전환에서 콘텐츠는 WP 로 갔지만
// site-config 는 payload 에 남아 있다(손익표 밖 항목 — 이중 소스 기간은 4단계까지).
// 4단계에서 WP 옵션 + 공개 REST 로 이관하고 payload 와 함께 이 파일을 대체한다.

export interface SiteConfigView {
  tagline: string;
  footerText: string;
  notice: { enabled: boolean; text: string; tone: "info" | "warning" };
}

const SITE_DEFAULTS = {
  tagline: "자격·기술 시험 대비 퀴즈 · 학습",
  footerText: "QuizDeck · self-hosted",
};

export async function getSiteConfigCms(): Promise<SiteConfigView> {
  const payload = await getPayload({ config });
  const g = await payload.findGlobal({ slug: "site-config", depth: 0, overrideAccess: true });
  return {
    tagline: g?.tagline || SITE_DEFAULTS.tagline,
    footerText: g?.footerText || SITE_DEFAULTS.footerText,
    notice: {
      enabled: Boolean(g?.notice?.enabled && g?.notice?.text?.trim()),
      text: g?.notice?.text ?? "",
      tone: g?.notice?.tone === "warning" ? "warning" : "info",
    },
  };
}
