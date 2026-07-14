import type { ExamSummary } from "../lib/types.ts";
import type { LocalizedExamData, LocalizedQuestion } from "../lib/content-localize.ts";
import { listExamsWp, loadExamLocalizedWp, loadProviderContentWp, loadQuestionsByKeysWp } from "./wp-client.ts";

// 서빙 로더 (ADR-0025) — CMS 계층(WordPress REST)의 앱-측 진입점. 함수명 *Cms 는 "CMS
// 계층"의 의미 — 구현이 무엇이든 소비처(홈·/me·컬렉션·exam layout)가 몰라도 되는 경계다.

export async function listExamsCms(): Promise<ExamSummary[]> {
  return listExamsWp();
}

export async function loadExamLocalizedCms(provider: string, slug: string): Promise<LocalizedExamData | null> {
  return loadExamLocalizedWp(provider, slug);
}

export async function loadProviderContentCms(provider: string) {
  return loadProviderContentWp(provider);
}

export async function loadQuestionsByKeysCms(
  items: { examKey: string; qn: number }[],
): Promise<{ examKey: string; qn: number; answer: string[]; content: LocalizedQuestion["content"] }[]> {
  return loadQuestionsByKeysWp(items);
}

export { getSiteConfigCms, type SiteConfigView } from "./serve-siteconfig.ts";
