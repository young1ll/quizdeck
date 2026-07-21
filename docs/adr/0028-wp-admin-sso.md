# 0028 — wp-admin SSO (앱 Better Auth = OIDC IdP)

- 상태: Accepted — 2026-07-21
- 관련: [[0003-better-auth-in-app.md|ADR-0003]](인증 기반) · [[0025-wordpress-headless-cms.md|ADR-0025]]
  (WP 경계) · [[0027-admin-annotation-management.md|ADR-0027]](WP→앱 서버-서버 선례)
- 코드: `lib/auth.ts` `oauthProviderPlugins` · `db/migrations/0012_oauth_provider.sql` ·
  `infra/wp/mu-plugins/quizdeck-cms/sso.php` · `infra/wp/Dockerfile`(oidc 스테이지) ·
  `k8s/wp/deployment.yaml` `QD_SSO_*`

## 맥락

"WP와 Better Auth 통합 가능한지?"(사용자, 2026-07-16) — wp-admin 로그인을 앱 계정으로 하는
SSO 가 유일하게 의미 있는 방향이었다(회원 DB 동기화=반패턴, 이용자 WP 로그인=무의미 — headless).
어시스턴트는 1인 운영 실익 대비 비용(플러그인 성숙도·장애 결합)을 들어 보류를 권했으나
사용자가 진행 확정.

## 결정

1. **앱 = OIDC IdP — `@better-auth/oauth-provider`(OAuth 2.1) 채택.** 내장 oidcProvider 기각:
   공식 deprecated(런타임 경고 + 차기 메이저 제거) + 기본 HS256 서명이 WP JWKS 검증과 부정합.
   플러그인은 **baseURL 있을 때만 조건부**(naverPlugins 결 — init 이 issuer URL 파싱, 무env
   빌드·테스트 보호). ID 토큰 서명·JWKS 는 기존 `jwt()` 재사용(EdDSA/Ed25519). `role` 커스텀
   클레임(customIdTokenClaims/customUserInfoClaims)으로 WP 쪽 게이트 근거 제공.
2. **WP 클라이언트 = daggerhart-openid-connect-generic v3.11.3** — wp.org zip 을 이미지에
   버전·sha256 고정 베이크. 활성화는 `sso.php`(mu-plugin)가 **require** 로 강제(DB
   active_plugins 무관 — DISALLOW_FILE_MODS·코드 소유 원칙). 설정은 **PHP 상수**(DB 옵션에
   우선 — GitOps): 엔드포인트=공개 `myquizdeck.com/api/auth/*`, `OIDC_ENDPOINT_JWKS_URL` 설정
   (번들 php-jwt 가 OKP/EdDSA 지원 + 이미지에 sodium — ID 토큰 서명 실검증).
3. **role=admin 게이트 + administrator 매핑.** `user-login-test`·`user-creation-test` 필터가
   role 클레임(콤마 다중 role 은 lib/admin isAdminRole 규칙)으로 차단, 생성 시
   `alter-user-data` 로 administrator 부여, 재로그인마다 role 재동기화.
4. **로컬 로그인 폴백 유지** — `login_type=button`(wp-login.php 폼 위 버튼). 앱 장애가 CMS
   로그인을 인질 잡지 않게(장애 결합 회피 + readinessProbe 가 wp-login.php 의존).
5. **클라이언트 = DB `oauthClient` 행, 수동 시드** — secret 은 git 밖. 시드 시퀀스(secret 생성
   → SHA-256/base64url 해시 INSERT → 평문은 WP `wp-sso` Secret)는 db/migrations/README 0012 절.
   `requirePKCE=false`(WP 플러그인이 PKCE 미지원 — confidential client + client_secret_post 라
   code flow 무결성 유지), `skipConsent=true`(1st-party 신뢰 클라이언트).
6. **후퇴 경로** — `wp-sso` Secret 제거 시 sso.php 전체 no-op(로컬 로그인만). 앱 플러그인·
   테이블 잔존 무해.

## 기각

- **내장 oidcProvider** — 결정 1.
- **회원 DB 동기화/미러링** — PII 이중화·탈퇴 cascade 단절·진실 소스 분열.
- **iframe 임베드** — 앱 세션 쿠키 host-only(ADR-0027 조사).
- **login_type=auto**(강제 SSO) — 폴백 상실(결정 4).

## 검증

- `lib/auth-oidc.integration.test.ts` — discovery(issuer·엔드포인트)·미인증 authorize → /login
  302·무등록 클라이언트 token 거부(실 postgres, 클라이언트 행 시드).
- `infra/wp/tests/cases/91-sso.php` — env 부재 no-op(상수·플러그인·훅 전부 미활성)·admin 클레임
  게이트 8케이스·administrator 매핑.
- 로컬 E2E: 앱+WP compose 로 버튼 → 앱 로그인 → 콜백 → wp-admin 진입/비admin 거부 실왕복.
- 배포 후: discovery 공개 200, wp-login 버튼·폴백 공존, 실로그인(tailnet), 비admin 거부.
