import type { ExamMeta } from "./types";
import type { QuizPhase } from "./quiz-flow-context";

// 적응형 맥락 헤더의 **결정**을 순수 함수로 (아키텍처 리뷰 header-model). 옛날엔 렌더리스 ExamHeaderBinder
// 가 3단 적응(ADR-0012 결정 6)을 JSX 에 얽어 slot 으로 불투명하게 밀어올려, 결정이 어느 인터페이스로도
// 테스트되지 않았다. 여기서 결정을 데이터(HeaderModel)로 내면 순수·테스트 가능하고, shell(LearnerHeader)이
// 그 모델을 렌더해 프레임·shell chrome(QuizDeck·계정)을 소유한다(중복 제거).

// exam 라우트 단일 출처 — base/검색/admin URL 이 여러 곳에 재구성되던 것을 여기로.
export interface ExamRoutes {
  hub: string;
  search: string;
  admin: string;
}
export function examRoutes(meta: { provider: string; slug: string }): ExamRoutes {
  const base = `/${meta.provider}/${meta.slug}`;
  return {
    hub: base,
    search: `${base}/search`,
    // Payload admin(ADR-0024 3단계) — 시험별 편집 화면이 따로 없어 문항 컬렉션 목록으로 보낸다.
    admin: "/admin/collections/questions",
  };
}

export interface HeaderContext {
  meta: ExamMeta;
  phase: QuizPhase;
  isOnQuizRoute: boolean; // pathname 이 /quiz 인가 — phase 와 함께 "퀴즈 화면에 있음"을 판정(참조 라우트 구별)
  isAdmin: boolean;
  current: { idx: number; total: number } | null; // 진행 중 세션의 위치(없으면 null)
  exam: boolean; // 시험 모드(타이머 표시)
  timeLeft: number | null; // 시험 남은 초
}

// 3단 적응(ADR-0012 결정 6)을 데이터로:
//  · quiz  = 퀴즈 active focus chrome(진행 n/N · [타이머])
//  · exam  = exam 안 브레드크럼(QuizDeck › 시험코드 · [편집] · 검색 · 계정)
// (바깥 = 기본 헤더는 slot 이 비었을 때 LearnerHeader 가 직접 — 모델 없음.)
export type HeaderModel =
  | { kind: "quiz"; progress: { position: number; total: number }; timer: { sec: number } | null }
  | {
      kind: "exam";
      examCode: string;
      hubHref: string;
      searchHref: string;
      adminHref: string | null;
    };

export function buildHeaderModel(ctx: HeaderContext): HeaderModel {
  const activeQuiz = ctx.phase === "active" && ctx.isOnQuizRoute && !!ctx.current;
  if (activeQuiz) {
    return {
      kind: "quiz",
      progress: { position: ctx.current!.idx + 1, total: ctx.current!.total },
      timer: ctx.exam && ctx.timeLeft !== null ? { sec: Math.max(0, ctx.timeLeft) } : null,
    };
  }
  const r = examRoutes(ctx.meta);
  return {
    kind: "exam",
    examCode: ctx.meta.code,
    hubHref: r.hub,
    searchHref: r.search,
    adminHref: ctx.isAdmin ? r.admin : null,
  };
}
