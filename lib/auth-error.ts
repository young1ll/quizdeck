// better-auth 에러 정규화 (아키텍처 리뷰 C6). 콜러가 `res.error.message ?? 한국어` 로 라이브러리
// **영어 메시지를 먼저** 노출하던 패턴을 한국어로 통일한다 — 알려진 코드는 특정 한국어로, 그 외는
// 콜러가 준 컨텍스트 fallback 으로(영어 message 를 노출하지 않는다 = 앱 전역 한국어 일관성). 코드→
// 한국어 맵을 한 곳에 둔다(그동안 ~7곳에 패턴이 흩어져 있었다). 순수 함수라 better-auth·React 없이
// 단위테스트된다.
//
// EMAIL_NOT_VERIFIED 는 "에러"가 아니라 "메일 확인" 노티스라 콜러(AuthForms)가 먼저 가로채므로
// 여기서 매핑하지 않는다(매핑하면 일반 에러로 취급돼 노티스 분기를 가린다).

export interface AuthResultLike {
  error?: { code?: string | null; message?: string | null } | null;
}

// 자주 보는 코어 코드만 — 그 외는 fallback. 잘못/누락돼도 fallback(한국어)이라 안전(영어 안 보임).
const CODE_KO: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "이메일 또는 비밀번호가 올바르지 않습니다.",
  USER_ALREADY_EXISTS: "이미 가입된 이메일입니다.",
  INVALID_PASSWORD: "현재 비밀번호가 올바르지 않습니다.",
  EMAIL_PASSWORD_DISABLED: "이메일 로그인을 사용할 수 없습니다.",
};

/**
 * better-auth 결과를 한국어 에러 메시지로 정규화한다. 에러가 없으면 null(콜러는 성공 처리).
 * 알려진 코드는 특정 한국어, 그 외는 fallback — 라이브러리 영어 message 는 노출하지 않는다.
 */
export function authErrorMessage(res: AuthResultLike, fallback: string): string | null {
  const e = res.error;
  if (!e) return null;
  return (e.code && CODE_KO[e.code]) || fallback;
}
