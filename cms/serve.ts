import type { ExamSummary } from "../lib/types.ts";
import type { LocalizedExamData, LocalizedQuestion } from "../lib/content-localize.ts";
import { listExamsWp, loadExamLocalizedWp, loadQuestionsByKeysWp } from "./wp-client.ts";

// 서빙 로더 (ADR-0025 3단계) — 소스가 Payload → WordPress REST 로 바뀌었다. RSC 소비처의
// 시그니처는 유지(홈·/me·컬렉션·exam layout 무변경). 함수명 *Cms 는 "CMS 계층"의 의미 —
// 구현이 무엇이든(같은 이름을 payload 시절부터 씀) 소비처가 몰라도 되는 게 이 파일의 존재 이유.
// payload 경로(cms/read.ts)는 4단계 폐기 전까지 verify 스크립트 전용으로 잔존.

export async function listExamsCms(): Promise<ExamSummary[]> {
  return listExamsWp();
}

export async function loadExamLocalizedCms(provider: string, slug: string): Promise<LocalizedExamData | null> {
  return loadExamLocalizedWp(provider, slug);
}

export async function loadQuestionsByKeysCms(
  items: { examKey: string; qn: number }[],
): Promise<{ examKey: string; qn: number; answer: string[]; content: LocalizedQuestion["content"] }[]> {
  return loadQuestionsByKeysWp(items);
}

export { getSiteConfigCms, type SiteConfigView } from "./serve-siteconfig.ts";
