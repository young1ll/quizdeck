// better-auth 런타임 설정의 env 해석 seam (이슈 #6).
//
// 순수 함수 — DB·네트워크에 접촉하지 않고 process.env(또는 임의 객체)만 읽는다.
// auth.ts 가 import 시점에 throw 하면 `next build`(컨테이너 빌드 시 env 없음)가
// 깨진다. 그래서 해석기는 절대 throw 하지 않고 `missing` 으로 보고만 하며,
// 강제(throw)는 명시적인 assertAuthConfigReady 로만 한다.
//
// 시크릿(BETTER_AUTH_SECRET·DATABASE_URL)은 git 밖 — 로컬은 .env.local,
// 프로덕션은 k8s Secret 로 주입한다(ADR-0003).

export interface AuthEnvInput {
  BETTER_AUTH_SECRET?: string;
  DATABASE_URL?: string;
  BETTER_AUTH_URL?: string;
  // process.env(인덱스 시그니처)도 그대로 받기 위함 — 위 키만 읽는다.
  [key: string]: string | undefined;
}

export interface ResolvedAuthConfig {
  /** 세션·JWT 서명 키. */
  secret?: string;
  /** postgres 접속 문자열(better-auth 어댑터 + 마이그레이션). */
  databaseUrl?: string;
  /** 절대 URL·trustedOrigins 기준. 미지정 시 better-auth 가 요청 오리진으로 추론. */
  baseURL?: string;
  /** 패스키(WebAuthn, #10) relying party ID = baseURL 호스트명. 미지정 시 undefined → 플러그인 기본 "localhost". */
  rpID?: string;
  /** 패스키 등록·인증 origin = baseURL 의 스킴+호스트(+포트). 미지정 시 undefined → 클라이언트가 전달. */
  origin?: string;
  /** 런타임 인증에 필수인데 비어 있는 env 키들. 비어 있지 않으면 인증이 동작하지 않는다. */
  missing: string[];
}

/** trim 후 빈 문자열이면 undefined — 미설정 env 와 공백 only 를 동일 취급. */
function nonEmpty(v: string | undefined): string | undefined {
  const t = v?.trim();
  return t ? t : undefined;
}

export function resolveAuthConfig(env: AuthEnvInput): ResolvedAuthConfig {
  const secret = nonEmpty(env.BETTER_AUTH_SECRET);
  const databaseUrl = nonEmpty(env.DATABASE_URL);
  const baseURL = nonEmpty(env.BETTER_AUTH_URL);

  // 패스키 rpID·origin 을 baseURL 에서 파생 — 별도 env 없이 단일 소스. 파싱 실패 시 둘 다
  // undefined(해석기는 throw 하지 않는다 — 빌드 경로 보호). origin 은 URL.origin 이라 경로·
  // trailing slash 가 제거되고 포트는 보존된다(WebAuthn origin 규약: 트레일링 / 금지).
  let rpID: string | undefined;
  let origin: string | undefined;
  if (baseURL) {
    try {
      const u = new URL(baseURL);
      rpID = u.hostname;
      origin = u.origin;
    } catch {
      /* 잘못된 URL — 파생 생략(플러그인 기본/클라이언트 전달에 위임) */
    }
  }

  const missing: string[] = [];
  if (!secret) missing.push("BETTER_AUTH_SECRET");
  if (!databaseUrl) missing.push("DATABASE_URL");

  return { secret, databaseUrl, baseURL, rpID, origin, missing };
}

/** 런타임 시작/테스트에서 설정 완전성을 강제한다. 빌드 경로에서는 호출하지 않는다. */
export function assertAuthConfigReady(cfg: ResolvedAuthConfig): void {
  if (cfg.missing.length > 0) {
    throw new Error(
      `[auth] 누락된 환경변수: ${cfg.missing.join(", ")} — ` +
        `로컬은 .env.local, 프로덕션은 k8s Secret 로 주입해야 인증이 동작한다.`,
    );
  }
}
