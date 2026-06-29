# 0003 — 인증·진도 동기화: Next 서버 + better-auth(in-app) + 외부 postgres(DB VM) + local-first

Status: accepted

## 맥락

[[../../CONTEXT.md#Learner|Learner]]별 [[../../CONTEXT.md#Progress|Progress]]를 **기기 간 동기화**하려면 서버측 신원·저장이 필요하다. [[0001-progressstore-seam.md|ADR-0001]]은 이를 위해 `ProgressStore`를 snapshot·async·LWW seam으로 forward-design했고, "postgres adapter는 후보 3(정적 export vs 서버) 결정에 묶임"이라 남겨 두었다. 이 ADR이 그 결정을 내린다. (그릴링 2026-06-24)

## 결정

1. **quizdeck를 Next.js standalone 서버로 전환** (`output:'export'` → `output:'standalone'`). 인증·세션·동기화 API를 **Route Handler**(`app/api/*`)에 둔다. 정적 export는 폐기한다.
2. **인증 = better-auth(in-app)** — 별도 IdP 프로세스 없음. 수단: **이메일+비밀번호 · GitHub · Google · Naver(generic OAuth) · 패스키(WebAuthn)**. 세션은 **같은 오리진 쿠키**(`myquizdeck.com`).
3. **데이터 tier = 별도 DB VM의 postgres** — 인터넷 미노출, k3s에서 **게스트↔게스트(OVS LAN)** 로만 접근(VM↔호스트 격리 회피). better-auth 테이블 + `progress(learner_id, exam_key, snapshot jsonb, updated_at, PK(learner_id,exam_key))`.
4. **Progress 동기화 = local-first composite `ProgressStore`** — localStorage 즉시 쓰기 + RemoteApi 백그라운드 동기화, load 시 `updated_at` 기준 LWW 병합, 새 기기는 서버 snapshot pull. active Session은 계속 비동기화([[0001-progressstore-seam.md|ADR-0001]] 유지).
5. **미래 확장**: 다른 목적의 API는 **NestJS pod**로 추가하고 better-auth의 **JWKS**로 JWT를 검증한다(better-auth = 경량 IdP-lite). 지금은 만들지 않는다.

## 왜

- **무거운 IdP는 과임.** Keycloak/Zitadel/Authentik(~700MB~1GB)은 4GB VM에 비용 과다 → in-app better-auth가 _가치 < 비용_ 에 부합("미리 사지 않음"). 단 **JWKS 노출**로 IdP 진화 경로는 열어 둔다.
- **Next 서버 전환**이 정적 export로는 불가능한 서버측 인증·동기화 API를 한 앱에서 idiomatic하게 제공한다 — [[0001-progressstore-seam.md|ADR-0001]]이 예고한 RemoteApi adapter의 백엔드.
- **별도 DB VM** = "Synology as VPC"의 **data tier 격리(private subnet · RDS 아날로그)** 실습이자, k3s 재설치와 DB 수명의 분리. ([[../architecture/0002-synology-vpc-platform.md|ADR-0002]]의 data tier 구체화.)
- **local-first** = [[0001-progressstore-seam.md|ADR-0001]]의 snapshot·async·LWW seam을 그대로 활용 → 오프라인·즉시 UX, 호출부 무변경 drop-in.

## 고려한 대안 (재제안 방지)

- **전용 IdP(OIDC: Keycloak/Zitadel/Authentik)** — 가장 현실적 엔터프라이즈/Cognito 학습이나, 4GB VM에 RAM 과임. JWKS 경로로 나중에 흡수 가능하므로 보류.
- **self-host BaaS(Supabase 등)** — 빠르나 무겁고 tier 직접 구축 학습이 줄며 결합↑.
- **in-cluster postgres 파드** — 가장 lean하나 RDS-analog/격리 학습 목표에 약함. DB 수명이 k3s에 묶임.
- **online-only 동기화** — 단순하나 오프라인 미지원. local-first가 기존 seam과 UX에 우월.

## 결과

- **배포 변경**: Dockerfile이 `nginx 정적` → `node standalone 서버`(포트 3000, readiness 변경). k8s Deployment/Service/Ingress 갱신. 기존 GitOps(Actions→ghcr→Argo)는 유지되나 이미지가 바뀐다.
- **시크릿**: `BETTER_AUTH_SECRET`, OAuth(GitHub/Google/Naver) client id·secret, DB 접속정보 → **k8s Secret(git 밖)**. OAuth 콜백 URL = `https://myquizdeck.com/api/auth/callback/*`.
- **DB VM 신규 프로비저닝**(autoinstall seed 재사용), postgres + 앱 role, pg_hba/방화벽으로 k3s VM에서만 접근.
- **anonymous → login 병합**: 첫 로그인 시 localStorage Progress를 서버로 병합(서버 비었으면 push, 아니면 LWW). 전용 병합 슬라이스(V3 / #8)는 [[0004-login-gating-and-email-verification.md|ADR-0004]] 결정 6이 이 naive 무프롬프트 LWW를 의식적으로 채택하고, 소프트 게이트(연습=Learner 전용)로 신규 익명 Progress 자체를 없애 **superseded** — #8 종료(2026-06-29).
- snapshot LWW의 per-field merge 불가 한계는 [[0001-progressstore-seam.md|ADR-0001]] 그대로 승계(의식적 수용).
