import type { GenericOAuthConfig } from "better-auth/plugins";
import type { SocialProviderCreds } from "./auth-config";

// Naver 소셜 로그인(V4, #9 / ADR-0003) — Naver 는 better-auth built-in provider 가 아니라
// generic OAuth 로 직접 구성한다(엔드포인트·프로필 매핑을 명시). GitHub·Google 은 built-in
// socialProviders 로 충분하지만 Naver 는 이 모듈이 필요하다.
//
// Naver userinfo(`/v1/nid/me`) 는 식별 필드를 `response` 아래에 중첩한다:
//   { resultcode, message, response: { id, email, name, nickname, profile_image } }
// better-auth 기본 getUserInfo 는 최상위 id/email 만 보므로 둘 다 undefined 가 되지만,
// 원본 객체(=`response` 포함)를 그대로 mapProfileToUser 에 넘긴다. 그래서 여기서 `response`
// 를 풀어 계정 식별자(response.id)·이메일·이름·이미지를 채워야 로그인이 동작한다.

const NAVER_AUTHORIZATION_URL = "https://nid.naver.com/oauth2.0/authorize";
const NAVER_TOKEN_URL = "https://nid.naver.com/oauth2.0/token";
const NAVER_USERINFO_URL = "https://openapi.naver.com/v1/nid/me";

/**
 * better-auth 기본 getUserInfo 가 넘기는 Naver 프로필을 User 필드로 매핑한다.
 * 중첩된 `response` 에서 끌어오며, Naver 가 준 이메일은 검증된 신원으로 표시한다.
 * `response` 가 없으면(비정상 응답) 식별자를 비워 better-auth 가 id_is_missing 으로 처리한다.
 */
export function mapNaverProfile(profile: Record<string, unknown>) {
  const r = (profile.response ?? {}) as Record<string, unknown>;
  return {
    id: r.id as string | undefined,
    email: r.email as string | undefined,
    // 소셜 인증 = 검증된 신원 — 이메일+비밀번호 경로의 재검증을 요구하지 않는다.
    emailVerified: true,
    name: (r.name ?? r.nickname) as string | undefined,
    image: r.profile_image as string | undefined,
  };
}

/** Naver 자격증명을 generic OAuth provider config 로 만든다. */
export function naverGenericOAuth(creds: SocialProviderCreds): GenericOAuthConfig {
  return {
    providerId: "naver",
    clientId: creds.clientId,
    clientSecret: creds.clientSecret,
    authorizationUrl: NAVER_AUTHORIZATION_URL,
    tokenUrl: NAVER_TOKEN_URL,
    userInfoUrl: NAVER_USERINFO_URL,
    mapProfileToUser: mapNaverProfile,
  };
}
