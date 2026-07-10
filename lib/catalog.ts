import type { ExamSummary } from "./types";

// 카탈로그 그룹핑 (데이터 모델 개선 ③ — 트랙). 홈 JSX 에 인라인이던 provider 묶음 결정을 순수
// 함수로 — 트랙(자격 계열, 예: 'AWS Solutions Architect')이 있으면 트랙으로, 없으면 provider 로
// 폴백해 묶는다. **그룹 키는 언어 무관 안정 id**(track.id / provider) — 표시 라벨(name)을 키로
// 쓰지 않는다(Topic/topicId 와 같은 규칙, CONTEXT.md). 그룹 순서는 입력(코드 정렬) 첫 등장 순.
export interface CatalogGroup {
  /** 안정 그룹 키 — track.id 또는 provider */
  id: string;
  /** 표시 라벨 — track.name 또는 providerName */
  name: string;
  exams: ExamSummary[];
}

/** 아이콘 최대 길이(UTF-16 유닛) — ZWJ 조합 이모지(예: 👨‍👩‍👧‍👦 = 11)까지 수용하는 여유치. */
export const ICON_MAX = 16;

/**
 * 아이콘 경계 검증 (ADR-0023) — 컬렉션·문제집 오버라이드가 공유. trim 후 빈 값은 null(= 아이콘
 * 없음/제거 의도), 한도 초과·비문자열은 undefined(불량 — 호출부가 거부).
 */
export function parseIcon(raw: unknown): string | null | undefined {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "string") return undefined;
  const s = raw.trim();
  if (!s) return null;
  return s.length <= ICON_MAX ? s : undefined;
}

export function groupExams(exams: ExamSummary[]): CatalogGroup[] {
  const byId = new Map<string, CatalogGroup>();
  for (const e of exams) {
    const id = e.track?.id ?? e.provider;
    const name = e.track?.name ?? e.providerName;
    const g = byId.get(id) ?? { id, name, exams: [] };
    g.exams.push(e);
    byId.set(id, g);
  }
  return [...byId.values()];
}
