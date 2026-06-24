# 설계 브리프 — 로그인 + 진도 동기화 (Learner 계정)

> 그릴링(2026-06-24) 산출물. 새 세션에서 `/to-prd` → `/to-issues` → 이슈별 `/implement`의 출발점.
> 확정 결정은 [ADR-0003](../adr/0003-auth-and-progress-sync.md), 데이터 seam은 [ADR-0001](../adr/0001-progressstore-seam.md), 플랫폼은 [ADR-0002](../architecture/0002-synology-vpc-platform.md).

## 목표

익명 사용은 그대로 두고, **[[Learner]]가 로그인해 자신의 Progress를 기기 간 동기화**한다. 다중 사용자(계정제). 공개 사이트 `myquizdeck.com`.

## 확정 결정 (ADR-0003)

| 항목 | 결정 |
|---|---|
| 앱 형태 | quizdeck를 **Next standalone 서버**로 전환(정적 export 폐기). 인증·동기화 API는 Route Handler. |
| 인증 | **better-auth (in-app)**, 별도 IdP 없음. 같은 오리진 쿠키 세션. |
| 인증 수단 | 이메일+비밀번호 · GitHub · Google · **Naver(generic OAuth)** · 패스키(WebAuthn) |
| 데이터 tier | **별도 DB VM의 postgres** (인터넷 미노출, k3s에서 게스트↔게스트 LAN만) |
| 동기화 | **local-first composite ProgressStore** (localStorage + RemoteApi, `updated_at` LWW, 백그라운드 동기화) |
| 미래 | 다른 API는 NestJS pod + **JWKS**로 JWT 검증(better-auth=IdP-lite) |

## 도메인

- **Learner** = 인증된 신원, Progress 소유([[CONTEXT.md]]). 익명 방문자는 Learner 아님(localStorage만).
- Progress 영속 키 = **(Learner, Exam)**. active Session은 동기화 비대상(ADR-0001 유지).

## 데이터 모델 (postgres)

- **better-auth 테이블**: user, session, account, verification, passkey (라이브러리 스키마/마이그레이션 따름).
- **progress**: `learner_id (FK user)`, `exam_key text`, `snapshot jsonb`, `updated_at timestamptz`, **PK (learner_id, exam_key)**.

## 작업 분해 (→ /to-issues 후보, 대체로 독립)

1. **Next 서버 전환** — `next.config` `output:'standalone'`, Dockerfile(node 런타임, 포트 3000), k8s Deployment/Service/Ingress·readiness 갱신, GitOps 통과 확인. *(정적+nginx 폐기)*
2. **DB VM 프로비저닝** — autoinstall seed 재사용해 postgres 전용 VM, postgres 설치, 앱 role/DB, **pg_hba/방화벽으로 k3s VM에서만 접근**(인터넷·호스트 미노출), 루트 디스크 여유 확인, 백업 메모.
3. **better-auth 통합** — 설정(postgres adapter), providers(GitHub/Google/Naver generic OAuth), 패스키 플러그인, **JWT/JWKS 플러그인**(미래 대비), 시크릿 → k8s Secret.
4. **ProgressStore RemoteApi + composite** — `remoteApiProgressStore`(fetch `/api/progress`) + `compositeProgressStore(local, remote)` LWW. `useStoreState`에 주입(seam 무변경 활용, ADR-0001).
5. **`/api/progress` Route Handler** — GET load / PUT save, **세션 Learner로 스코프**(타인 데이터 차단).
6. **anonymous → login 병합** — 첫 로그인 시 localStorage Progress를 서버로 병합(빈 서버면 push, 아니면 LWW). UX(병합 확인).
7. **계정 UI** — 로그인/가입/프로필/로그아웃, 동기화 상태 표시, 익명도 계속 사용 가능.

## 구현 전 필요한 사용자 액션 (외부 등록)

- **GitHub OAuth App** (callback `https://myquizdeck.com/api/auth/callback/github`)
- **Google OAuth 클라이언트** (callback `.../callback/google`)
- **Naver 애플리케이션** (callback `.../callback/naver`)
- 각 client id/secret → k8s Secret로 전달.

## 보안·불변식

- **postgres 인터넷 미노출** (DB VM, k3s에서만). [[ADR-0002]] 불변식 승계.
- 시크릿(better-auth secret, OAuth 자격, DB 접속)은 **k8s Secret(git 밖)**.
- 쿠키: Secure·HttpOnly·SameSite. CSRF·rate-limit는 better-auth 기능 활용/확인.
- snapshot LWW per-field merge 불가(ADR-0001 의식적 승계).

## 리소스 메모

- DB VM RAM ~512MB~1GB(호스트 여유 내). k3s VM은 better-auth라 무거운 IdP 없음 → 큰 증설 불필요.
- 루트 LV 14G(여유 4.5G) — DB는 DB VM에 두므로 k3s VM 디스크 압박은 완화. 필요 시 `lvextend`.

## 열린 질문 (구현 초기에 확정)

- 이메일 검증/비번 재설정의 **SMTP** 필요 여부(없으면 OAuth·패스키 우선, 이메일+비번은 검증 생략 옵션).
- progress 저장 빈도/디바운스(remote write 폭증 방지) — ADR-0001 debounce를 remote에도.
- exam_key 정규화(`provider/exam`)와 다중 시험 확장의 정합.
