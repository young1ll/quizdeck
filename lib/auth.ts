import { betterAuth } from "better-auth";
import { jwt, admin } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import { dash } from "@better-auth/infra";
import { pool } from "./db";
import { resolveAuthConfig } from "./auth-config";
import { sendEmail, verificationEmail, resetPasswordEmail } from "./email";

// better-auth (in-app, postgres adapter) — 별도 IdP 프로세스 없음. (ADR-0003 / 이슈 #6)
//
// 이 슬라이스 범위: 이메일+비밀번호 가입·로그인·로그아웃 + 같은 오리진 쿠키 세션
// + JWKS 노출. 소셜 로그인(V4)·패스키(V5)·Progress 동기화(V2)는 후속.

const cfg = resolveAuthConfig(process.env);

if (cfg.missing.length > 0) {
  // 빌드 시점(컨테이너 빌드엔 env 없음)엔 정상 — 런타임 요청에서 명확히 실패한다.
  // 런타임(k8s)에선 Secret 주입으로 채워진다.
  console.warn(
    `[auth] 누락된 환경변수: ${cfg.missing.join(", ")} — 주입 전까지 인증이 동작하지 않는다.`,
  );
}

export const auth = betterAuth({
  // 공유 node-postgres Pool(lib/db.ts) — better-auth 가 postgres(kysely) 어댑터로 인식.
  database: pool,
  secret: cfg.secret,
  // 미지정 시 better-auth 가 요청 오리진으로 추론. 프로덕션은 https://myquizdeck.com.
  baseURL: cfg.baseURL,
  // 이메일+비밀번호. 이메일 인증 필수 + Resend 발송. (ADR-0004 — 이슈 #6의 "검증 OFF"를 뒤집음)
  //
  // better-auth 표준 보호 (이슈 #6 AC: 활성/확인):
  //  - 비밀번호 해시: 기본 scrypt — 통합 테스트로 평문 비저장 확인.
  //  - CSRF/origin 체크: 아래 advanced.disableOriginCheck:false 로 모든 환경에서 활성화
  //    (better-auth 는 test 에서 기본 skip). 쿠키 동반(=실제 CSRF 벡터) 교차 오리진
  //    요청을 403 으로 거부 — 통합 테스트로 확인. 같은 오리진 앱이라 정상 요청엔 무해.
  //  - rate-limit: better-auth 가 프로덕션(NODE_ENV=production, Dockerfile 이 설정)에서
  //    기본 활성. dev/test 는 기본(off) 유지 — 다중요청 테스트를 교란하지 않도록.
  advanced: {
    disableOriginCheck: false,
  },
  // 회원 탈퇴 활성화 (이슈 #36 / ADR-0006). client deleteUser({ password }) 가 현재 비번을
  // 재확인하고 user 행을 지운다 → DB FK cascade(Progress 0002·Annotation 0006·session·account)로
  // 그 Learner 데이터가 함께 정리된다. 이메일-링크 확인은 후속(비번 확인으로 충분, ADR-0006).
  //
  // 이메일 변경 활성화 (이슈 #38 / ADR-0006). verified 사용자가 changeEmail({ newEmail }) 하면
  // better-auth 가 아래 emailVerification.sendVerificationEmail 콜백을 재사용해 **새 주소로** 인증
  // 링크를 보내고, 클릭 전까지는 기존 이메일을 유지한다(클릭 시 교체). 별도 콜백/2단계 불요.
  user: {
    deleteUser: { enabled: true },
    changeEmail: { enabled: true },
  },
  emailAndPassword: {
    enabled: true,
    // 검증 전엔 sign-in 차단 → Learner = 이메일 검증된 신원. (ADR-0004)
    requireEmailVerification: true,
    // 비밀번호 재설정 — better-auth 가 만든 url(서버 콜백 → /reset-password?token=)을 메일로.
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({ to: user.email, ...resetPasswordEmail(url) });
    },
  },
  // 이메일 검증 — 가입 즉시 검증 메일 발송, 링크 클릭(verify-email 엔드포인트)으로 검증 +
  // 자동 로그인. SMTP 미구성(로컬/테스트)에선 email.ts 가 콘솔로 링크를 노출(발송 건너뜀).
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({ to: user.email, ...verificationEmail(url) });
    },
  },
  // JWT/JWKS 플러그인 — 미래 NestJS pod 가 better-auth 를 IdP-lite 로 검증할
  // JWKS 를 노출한다(GET /api/auth/jwks). 지금 소비자는 없다 — 노출까지만. (ADR-0003)
  //
  // dash — Better Auth Infrastructure(https://dash.better-auth.com) 호스티드
  // 대시보드 연결. /dash/* 엔드포인트를 노출해 대시보드가 사용자·세션·이벤트를
  // 조회한다. apiKey 는 기본값 process.env.BETTER_AUTH_API_KEY(k8s Secret 주입)를
  // 읽는다. 키 부재(빌드 시점)엔 "" 로 폴백 — init throw 없음, 런타임 요청에서만 검증.
  // activityTracking 은 기본 OFF — 켜면 user 테이블에 lastActiveAt 스키마가 필요.
  // admin — 콘텐츠 편집 권한 경계(ADR-0005 B / 이슈 #27). user.role 을 더해 'admin' role 만
  // /admin·콘텐츠 변경 API 를 통과시킨다(getSession 이 role 을 실어준다). ban/impersonate API 도
  // 따라오나 지금 소비자는 콘텐츠 CRUD 의 role 체크뿐. 첫 admin 은 DB 에서 수동 지정(0004 참고).
  //
  // passkey — WebAuthn 패스키 로그인(V5 / 이슈 #10, ADR-0003 결정 2의 인증 수단). better-auth
  // 1.4 부터 core 에서 분리돼 @better-auth/passkey 패키지로 제공된다. 외부 IdP·OAuth 등록 없이
  // 같은 오리진에서 등록·인증한다. rpID·origin 은 baseURL 에서 파생(auth-config) — 미지정(로컬)
  // 이면 기본 rpID "localhost"/클라이언트 origin. 패스키 테이블은 라이브러리 스키마(0007, 0001 처럼).
  // > 0007 을 앱(패스키 API) 배포보다 먼저 적용해야 등록/로그인이 동작한다.
  plugins: [
    jwt(),
    dash(),
    admin(),
    passkey({ rpID: cfg.rpID, rpName: "quizdeck", origin: cfg.origin }),
  ],
});
