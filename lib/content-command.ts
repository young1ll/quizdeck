import type { Question, Concept } from "./types";
import { isValidQuestion, isValidConcept } from "./content-validate";

// 콘텐츠 변경 배선 봉투 (아키텍처 리뷰 content-command / ADR-0015 후속). raw 요청 body 를 검증된
// ContentCommand 로 디코드하는 순수·클라-안전 seam. 그동안 admin/content/route 가 type 디스패치·필드
// 가드·검증을 인라인으로 들고 있어 무-DB CI 에서 미검증이었다(정답 ⊂ options 도 skipIf(!DATABASE_URL)).
// 봉투를 한 곳으로 내면: (1) 디스패치가 순수·DB 없이 핀되고, (2) 클라(ContentEditor)가 전송 전 같은
// 함수로 셀프 프리플라이트해 라운드트립 없이 인라인 검증하며, (3) 와이어 = ContentCommand 라 클라
// build·서버 decode 두 어댑터가 문자 그대로 같은 타입을 넘는다(두 어댑터 = 진짜 seam). 저장 봉투
// (toQuestionSlot·content-localize)·편집기 로직은 이 seam 밖(각각 그대로·별도 후보 C2).

// 4-arm 판별 union — kind 가 op(upsert·delete)와 entity(question·concept)를 함께 담는다(와이어 자기기술).
export type ContentCommand =
  | { kind: "upsert-question"; examKey: string; lang: string; question: Question }
  | { kind: "upsert-concept"; examKey: string; lang: string; ord: number; concept: Concept }
  | { kind: "delete-question"; examKey: string; qn: number }
  | { kind: "delete-concept"; examKey: string; svc: string };

const KINDS = ["upsert-question", "upsert-concept", "delete-question", "delete-concept"] as const;

function nonEmptyStr(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

/**
 * raw body → 검증된 ContentCommand | 거절 사유. 순수·클라-안전(pg import 없음)이라 서버 route 가
 * decode 로, 클라 ContentEditor 가 전송 전 셀프 프리플라이트로 **같은 함수**를 쓴다. leaf 불변식
 * (정답 ⊂ options 등)은 content-validate 에 위임한다.
 */
export function parseContentCommand(body: unknown): ContentCommand | { error: string } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { error: "body must be an object" };
  }
  const b = body as Record<string, unknown>;
  const { kind } = b;
  if (typeof kind !== "string" || !(KINDS as readonly string[]).includes(kind)) {
    return { error: "unknown kind" };
  }
  // 모든 command 는 (Exam, examKey) 스코프를 요구한다.
  if (!nonEmptyStr(b.examKey)) return { error: "examKey required" };
  const examKey = b.examKey;

  switch (kind) {
    case "upsert-question": {
      if (!nonEmptyStr(b.lang)) return { error: "lang required" };
      if (!isValidQuestion(b.question)) {
        return { error: "invalid question (정답 ⊂ options·필수 필드 확인)" };
      }
      return { kind, examKey, lang: b.lang, question: b.question };
    }
    case "upsert-concept": {
      if (!nonEmptyStr(b.lang)) return { error: "lang required" };
      if (typeof b.ord !== "number" || !Number.isInteger(b.ord) || b.ord < 0) {
        return { error: "ord must be a non-negative integer" };
      }
      if (!isValidConcept(b.concept)) return { error: "invalid concept (필수 필드 확인)" };
      return { kind, examKey, lang: b.lang, ord: b.ord, concept: b.concept };
    }
    case "delete-question": {
      if (typeof b.qn !== "number" || !Number.isInteger(b.qn)) {
        return { error: "qn must be an integer" };
      }
      return { kind, examKey, qn: b.qn };
    }
    case "delete-concept": {
      if (!nonEmptyStr(b.svc)) return { error: "svc required" };
      return { kind, examKey, svc: b.svc };
    }
  }
  return { error: "unknown kind" }; // 도달 불가 — KINDS 검사로 전부 처리됨(TS 만족용).
}
