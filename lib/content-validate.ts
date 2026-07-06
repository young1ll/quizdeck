import type { Concept, Question } from "./types";

// 콘텐츠 경계 검증 — 순수 도메인 불변식 (아키텍처 리뷰 route-guards). 옛날엔 admin/content/route 안에
// unexported 로 있어 DB 통합 테스트로만 커버됐다. 도메인 규칙(정답 ⊂ options 등)이라 타입 곁으로 옮겨
// 순수·클라-안전·DB 없이 테스트 가능하게 한다 — 라우트는 import 해 throw, ContentEditor 도 같은 규칙을
// 재사용할 수 있다(클라/서버 규칙 이중구현 방지, 후속 content-envelope 정리와 결).

/** 정답 글자 ⊂ options 키 + 필수 필드 + 타입(실 경계 검증, global §9). answer 가 컬럼인 이유 — ADR-0005 결정 7. */
export function isValidQuestion(q: unknown): q is Question {
  if (typeof q !== "object" || q === null) return false;
  const o = q as Record<string, unknown>;
  if (typeof o.qn !== "number" || !Number.isInteger(o.qn) || o.qn <= 0) return false; // PK
  if (typeof o.q !== "string" || !o.q.trim()) return false;
  if (typeof o.topic !== "string") return false;
  if (typeof o.options !== "object" || o.options === null || Array.isArray(o.options)) return false;
  const opts = o.options as Record<string, unknown>;
  const optKeys = Object.keys(opts);
  if (optKeys.length === 0) return false;
  if (!optKeys.every((k) => typeof opts[k] === "string")) return false; // 보기 값은 문자열
  if (!Array.isArray(o.answer) || o.answer.length === 0) return false;
  return (o.answer as unknown[]).every((a) => typeof a === "string" && optKeys.includes(a));
}

export function isValidConcept(c: unknown): c is Concept {
  if (typeof c !== "object" || c === null) return false;
  const o = c as Record<string, unknown>;
  const required = ["cat", "svc", "deff", "key", "when", "trap", "vs"];
  return required.every((f) => typeof o[f] === "string" && (o[f] as string).length > 0);
}
