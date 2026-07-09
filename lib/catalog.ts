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
