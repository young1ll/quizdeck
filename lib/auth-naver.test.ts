import { describe, it, expect } from "vitest";
import { mapNaverProfile, naverGenericOAuth } from "./auth-naver";

// Naver 소셜 로그인(V4, #9) — Naver 는 better-auth built-in provider 가 아니라 generic OAuth 로
// 구성한다. Naver userinfo(`/v1/nid/me`)는 식별 필드를 최상위가 아니라 `response` 아래에 중첩한다:
//   { resultcode, message, response: { id, email, name, nickname, profile_image } }
// better-auth 의 기본 getUserInfo 는 최상위 id/email 만 보므로 둘 다 undefined 가 된다(중첩 보존).
// mapProfileToUser 가 그 보존된 `response` 에서 id/email/name/image 를 끌어와야 계정 생성·로그인이
// 동작한다(계정 식별자=response.id). 이 매핑이 Naver 경로의 핵심이라 순수 함수로 단위 테스트한다.
describe("mapNaverProfile", () => {
  // 기본 getUserInfo 가 만들어 mapProfileToUser 에 넘기는 형태(최상위 id/email 은 undefined,
  // 원본 response 는 보존됨).
  const fromDefaultGetUserInfo = {
    resultcode: "00",
    message: "success",
    response: {
      id: "naver-uid-123",
      email: "learner@example.com",
      name: "홍길동",
      nickname: "쪽지",
      profile_image: "https://ssl.pstatic.net/abc.jpg",
    },
    id: undefined,
    email: undefined,
    emailVerified: false,
    name: undefined,
    image: undefined,
  };

  it("중첩된 response 에서 계정 식별자·이메일·이름·이미지를 끌어온다", () => {
    const u = mapNaverProfile(fromDefaultGetUserInfo);
    expect(u.id).toBe("naver-uid-123");
    expect(u.email).toBe("learner@example.com");
    expect(u.name).toBe("홍길동");
    expect(u.image).toBe("https://ssl.pstatic.net/abc.jpg");
  });

  it("Naver 가 준 이메일은 검증된 것으로 표시한다(소셜 인증 = 검증된 신원)", () => {
    const u = mapNaverProfile(fromDefaultGetUserInfo);
    expect(u.emailVerified).toBe(true);
  });

  it("name 이 없으면 nickname 으로 폴백한다", () => {
    const u = mapNaverProfile({
      response: { id: "x", email: "a@b.com", nickname: "닉네임만" },
    });
    expect(u.name).toBe("닉네임만");
  });

  it("response 가 없어도 throw 하지 않고 식별자를 비운다(better-auth 가 id_is_missing 로 처리)", () => {
    const u = mapNaverProfile({});
    expect(u.id).toBeUndefined();
    expect(u.email).toBeUndefined();
  });
});

describe("naverGenericOAuth", () => {
  const cfg = naverGenericOAuth({ clientId: "n-id", clientSecret: "n-secret" });

  it("Naver OAuth2 엔드포인트와 자격증명을 generic OAuth config 로 구성한다", () => {
    expect(cfg.providerId).toBe("naver");
    expect(cfg.clientId).toBe("n-id");
    expect(cfg.clientSecret).toBe("n-secret");
    expect(cfg.authorizationUrl).toBe("https://nid.naver.com/oauth2.0/authorize");
    expect(cfg.tokenUrl).toBe("https://nid.naver.com/oauth2.0/token");
    expect(cfg.userInfoUrl).toBe("https://openapi.naver.com/v1/nid/me");
  });

  it("프로필 매핑으로 mapNaverProfile 을 연결한다", () => {
    expect(cfg.mapProfileToUser).toBe(mapNaverProfile);
  });
});
