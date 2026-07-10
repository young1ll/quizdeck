export interface Question {
  qn: number;
  /** 표시용 주제 라벨(현재 언어). 지역화 텍스트 — 언어 토글 시 바뀐다. UI 표시에만 쓴다. */
  topic: string;
  /**
   * 안정 주제 id(언어 무관) — 그룹/필터/조인 키. canonical(meta.language) 슬롯의 topic 에서 파생돼
   * 언어 토글에도 불변이다(아키텍처 리뷰 topic-id). 없으면(fixture·구 데이터) 소비부가 topic 으로 폴백.
   * topic 은 지역화 문자열이라 그 자체를 키로 쓰면 언어 토글 시 필터가 빈다(latent 버그)를 막는다.
   */
  topicId?: string;
  /** 시나리오 본문(마크다운). "(N개를 선택하세요)" 안내 포함 가능 */
  q: string;
  /** 보기: { "A": "텍스트", "B": "텍스트", ... } */
  options: Record<string, string>;
  /** 정답 글자 배열, 예: ["A","D","F"] */
  answer: string[];
  explanation?: string;
  tip?: string;
  /** 지문 이미지 URL(Payload media — /api/cms/media/file/…). 언어 무관. (ADR-0024 확장 F) */
  image?: string;
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

/** 시험 트랙(자격 계열) — 카탈로그 묶음. id 는 언어 무관 안정 키(그룹/정렬), name 은 표시 라벨.
 *  라벨을 그룹 키로 쓰지 않는다(Topic/topicId 와 같은 규칙 — CONTEXT.md). */
export interface ExamTrack {
  id: string;
  name: string;
}

export interface ExamMeta {
  provider: string;
  providerName: string;
  code: string;
  name: string;
  slug: string;
  language: string;
  /** 카탈로그·카드 표시용 아이콘(이모지). 없으면 미표시. 소스 = Payload exams.icon (ADR-0024). */
  icon?: string;
  /** 트랙(자격 계열). 없으면 카탈로그가 provider 묶음으로 폴백. */
  track?: ExamTrack;
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
  icon?: string;
  track?: ExamTrack;
  questionCount: number;
}
