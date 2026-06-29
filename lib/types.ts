export interface Question {
  qn: number;
  topic: string;
  /** 시나리오 본문(마크다운). "(N개를 선택하세요)" 안내 포함 가능 */
  q: string;
  /** 보기: { "A": "텍스트", "B": "텍스트", ... } */
  options: Record<string, string>;
  /** 정답 글자 배열, 예: ["A","D","F"] */
  answer: string[];
  explanation?: string;
  tip?: string;
  page?: number | string;
  deeplink?: string;
}

export interface Concept {
  cat: string;
  svc: string;
  abbr?: string;
  deff: string;
  detail?: string;
  key: string;
  when: string;
  trap: string;
  vs: string;
  cost?: string;
  /** 관련 문항 번호(일부, 최대 표시분) */
  rel?: number[];
  /** 관련 문항 총 개수 */
  reln?: number;
}

export interface Diagram {
  id: string;
  title: string;
  cat: string;
  caption: string;
  /** 인라인 SVG 마크업 */
  svg: string;
}

export interface ExamMeta {
  provider: string;
  providerName: string;
  code: string;
  name: string;
  slug: string;
  language: string;
  counts: { questions: number; concepts: number; diagrams: number };
}

// (콘텐츠 i18n 후 ExamData 는 LocalizedExamData(lib/content-localize.ts) 로 대체됨 — #28)

/** 카탈로그(홈) 표시에 필요한 최소 정보 */
export interface ExamSummary {
  provider: string;
  providerName: string;
  slug: string;
  code: string;
  name: string;
  questionCount: number;
}
