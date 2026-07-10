import type { Mode, SessionState } from "./store";
import { setsEqual } from "./session";

// 세션 상태 전이 — 순수 core (아키텍처 리뷰). useQuizController 의 쓰기 전이(start·select·submit·next…)가
// 훅 안에서 React state·store 부작용·타이머·Date.now 와 얽혀 순수 테스트 불가였다(exam 모드·resume 타이머·
// finishExam 전체채점이 무테스트). 상태 전이만 여기로 빼서 결정적으로 만든다 — 불순물(now·queue·active)은
// 훅(shell)이 해결해 액션 데이터로 주입한다(functional core / imperative shell). 부작용(recordResult·
// pushSession·setActive·콜백)·결과 집계(computeResult)·pool 구성(basePool/shuffle/rng)은 훅에 남는다.
// null → 세션 없음. 전이가 무의미하면(가드 미충족) 입력 state 를 그대로 돌려준다(no-op).
export type SessionAction =
  | { type: "start"; queue: number[]; mode: Mode; exam: boolean; limit?: number; now: number }
  | { type: "studyOne"; qn: number; now: number }
  | { type: "studySet"; qns: number[]; now: number }
  | { type: "resume"; active: SessionState; now: number }
  | { type: "select"; key: string; multi: boolean }
  | { type: "submit"; answer: string[] }
  | { type: "next" }
  | { type: "prev" }
  | { type: "navTo"; idx: number }
  | { type: "toggleFlag" }
  | { type: "retryWrong"; queue: number[]; now: number };

export function sessionReducer(
  state: SessionState | null,
  action: SessionAction,
): SessionState | null {
  switch (action.type) {
    case "start":
      return {
        queue: action.queue,
        idx: 0,
        mode: action.mode,
        exam: action.exam,
        answers: {},
        flags: [],
        start: action.now,
        elapsed: 0,
        ...(action.exam ? { limit: action.limit } : {}),
      };

    case "studyOne":
      return {
        queue: [action.qn],
        idx: 0,
        mode: "study",
        exam: false,
        answers: {},
        flags: [],
        start: action.now,
        elapsed: 0,
      };

    // studyOne 의 목록판 — 컬렉션 '이 시험에서 풀기'(ADR-0022 S1.5)가 임의 qn 목록을 큐로 학습.
    // 빈 목록 가드는 컨트롤러(studySet — byQn 존재 필터 후 empty→false)가 소유, 여기선 전이만.
    case "studySet":
      return {
        queue: action.qns,
        idx: 0,
        mode: "study",
        exam: false,
        answers: {},
        flags: [],
        start: action.now,
        elapsed: 0,
      };

    case "resume":
      // 이어하기 — 저장된 elapsed 만큼 지난 것으로 start 를 뒤로 당긴다(타이머 연속). timeLeft 는 훅이 계산.
      return { ...action.active, start: action.now - (action.active.elapsed || 0) * 1000 };

    case "select": {
      if (!state) return state;
      const qn = state.queue[state.idx];
      // 비시험에서 이미 채점된 문항은 변경 불가
      if (!state.exam && state.answers[qn]?.ok !== undefined) return state;
      const cur = state.answers[qn]?.sel ?? [];
      const sel = action.multi
        ? cur.includes(action.key)
          ? cur.filter((x) => x !== action.key)
          : [...cur, action.key]
        : [action.key];
      return { ...state, answers: { ...state.answers, [qn]: { ...state.answers[qn], sel } } };
    }

    case "submit": {
      if (!state) return state;
      const qn = state.queue[state.idx];
      const sel = state.answers[qn]?.sel ?? [];
      if (!sel.length) return state; // 미선택이면 no-op
      const ok = setsEqual(sel, action.answer);
      return { ...state, answers: { ...state.answers, [qn]: { sel, ok } } };
    }

    case "next":
      if (!state || state.idx >= state.queue.length - 1) return state;
      return { ...state, idx: state.idx + 1 };

    case "prev":
      if (!state || state.idx <= 0) return state;
      return { ...state, idx: state.idx - 1 };

    case "navTo":
      if (!state || action.idx < 0 || action.idx >= state.queue.length) return state;
      return { ...state, idx: action.idx };

    case "toggleFlag": {
      if (!state) return state;
      const qn = state.queue[state.idx];
      const flags = state.flags.includes(qn)
        ? state.flags.filter((f) => f !== qn)
        : [...state.flags, qn];
      return { ...state, flags };
    }

    case "retryWrong":
      return {
        queue: action.queue,
        idx: 0,
        mode: "wrong",
        exam: false,
        answers: {},
        flags: [],
        start: action.now,
        elapsed: 0,
      };
  }
}

// 진행 중 세션에 경과 시간(elapsed)을 스탬프한 사본 — 훅이 store.active 로 영속할 때 쓴다(quit·persist).
// now 주입으로 순수. elapsed = round((now - start)/1000).
export function stampElapsed(state: SessionState, now: number): SessionState {
  return { ...state, elapsed: Math.round((now - state.start) / 1000) };
}
