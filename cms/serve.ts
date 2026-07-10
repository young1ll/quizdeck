import { getPayload } from "payload";
import config from "@payload-config";
import type { ExamSummary } from "../lib/types.ts";
import type { LocalizedExamData, LocalizedQuestion } from "../lib/content-localize.ts";
import {
  listExamsFromPayload,
  loadExamLocalizedFromPayload,
  loadQuestionsByKeysFromPayload,
} from "./read.ts";

// 서빙 로더 (ADR-0024 3단계) — RSC 가 쓰는 앱-측 진입점. 구 하이브리드 로더(lib/content.ts
// listExams/loadExamLocalized + 아이콘 오버라이드 병합)를 대체한다: 카탈로그·아이콘이 전부
// exams 문서 안이라 오버레이 병합 이음새(applyIconOverrides)가 사라졌다. Local API — 네트워크
// 홉 없음, getPayload 는 프로세스 전역 캐시라 요청마다 초기화하지 않는다.
// 스크립트(cms/migrate-content 등)는 이 모듈이 아니라 read.ts 를 직접 쓴다(@payload-config
// 별칭은 Next 번들러 전용 — tsx 는 못 푼다).

export async function listExamsCms(): Promise<ExamSummary[]> {
  return listExamsFromPayload(await getPayload({ config }));
}

export async function loadExamLocalizedCms(
  provider: string,
  slug: string,
): Promise<LocalizedExamData | null> {
  return loadExamLocalizedFromPayload(await getPayload({ config }), provider, slug);
}

// 사이트 설정 Global (확장 D) — 미저장/빈 필드는 기존 하드코딩 문구로 폴백해 렌더가 항상 성립한다.
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

export async function loadQuestionsByKeysCms(
  items: { examKey: string; qn: number }[],
): Promise<{ examKey: string; qn: number; answer: string[]; content: LocalizedQuestion["content"] }[]> {
  return loadQuestionsByKeysFromPayload(await getPayload({ config }), items);
}
