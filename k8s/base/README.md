# quizdeck Deployment 시크릿 (git 밖 — 절대 커밋 금지)

quizdeck Deployment(`k8s/base/deployment.yaml`)가 `env.valueFrom.secretKeyRef` 로
주입받는 시크릿이다. 값은 git 에 들어가지 않는다(`cloudflared-token` 과 동일 원칙).
Argo CD 의 kustomize 리소스에 포함되지 않으므로 **동기화 대상이 아니다 — 존재만 의존**한다.

## `quizdeck-auth` (이슈 #6 + ADR-0004)

better-auth 의 세션·JWT 서명 키(`BETTER_AUTH_SECRET`), Better Auth Infra 대시보드 API
키(`BETTER_AUTH_API_KEY`), Resend 트랜잭션 이메일 키(`RESEND_API_KEY`). kubectl 호스트에서 1회:

```sh
# BETTER_AUTH_API_KEY = dash.better-auth.com 발급, RESEND_API_KEY = resend.com 발급(Sending access)
kubectl -n quizdeck create secret generic quizdeck-auth \
  --from-literal=BETTER_AUTH_SECRET="$(openssl rand -base64 32)" \
  --from-literal=BETTER_AUTH_API_KEY="ba_..." \
  --from-literal=RESEND_API_KEY="re_..."
```

- `BETTER_AUTH_SECRET`: 32자 이상 무작위 값(better-auth 가 저엔트로피 키를 경고).
  교체(rotate)하면 기존 세션 쿠키·발급된 JWT 가 모두 무효가 된다.
- `BETTER_AUTH_API_KEY`: https://dash.better-auth.com 프로젝트 설정에서 발급·로테이트.
  `lib/auth.ts` 의 `dash()` 가 이 키로 대시보드에 연결한다. 노출 시 대시보드에서 재발급.
- `RESEND_API_KEY`: https://resend.com 발급. `lib/email.ts` 가 이메일 인증·비밀번호 재설정
  메일을 보낸다(ADR-0004). 발신주소 `EMAIL_FROM` 은 비시크릿이라 Deployment 평문 env.
  로테이트: Resend 에서 재발급 → `kubectl patch secret quizdeck-auth`(아래) → `rollout restart`.

이미 Secret 이 있고 키만 추가/교체할 때:

```sh
kubectl -n quizdeck patch secret quizdeck-auth --type merge \
  -p "{\"data\":{\"BETTER_AUTH_API_KEY\":\"$(printf %s 'ba_...' | base64)\"}}"
kubectl -n quizdeck rollout restart deploy/quizdeck   # env 재주입
```

### 소셜 로그인 OAuth 키 (V4 / 이슈 #9)

GitHub·Google·Naver 의 client id/secret 6개도 같은 `quizdeck-auth` Secret 에 보관한다.
Deployment 는 이들을 `optional: true` 로 참조하므로 **키가 없어도 파드는 정상 기동**하고,
양쪽(id+secret)이 채워진 provider 만 런타임에 켜진다(`lib/auth-config.ts`). 외부 앱을 먼저
등록해야 한다 — **콜백 URL**:

- GitHub: `https://myquizdeck.com/api/auth/callback/github` (github.com/settings/developers)
- Google: `https://myquizdeck.com/api/auth/callback/google` (console.cloud.google.com OAuth 클라이언트)
- Naver: `https://myquizdeck.com/api/auth/oauth2/callback/naver` (developers.naver.com — generic
  OAuth 라 **경로가 `/oauth2/callback/` 로 다르다**. 네아로 제공정보에 이메일·이름 필수)

발급한 6개 값을 Secret 에 병합 후 rollout 하면 버튼이 동작한다:

```sh
kubectl -n quizdeck patch secret quizdeck-auth --type merge -p "{\"data\":{
  \"GITHUB_CLIENT_ID\":\"$(printf %s '...' | base64)\",
  \"GITHUB_CLIENT_SECRET\":\"$(printf %s '...' | base64)\",
  \"GOOGLE_CLIENT_ID\":\"$(printf %s '...' | base64)\",
  \"GOOGLE_CLIENT_SECRET\":\"$(printf %s '...' | base64)\",
  \"NAVER_CLIENT_ID\":\"$(printf %s '...' | base64)\",
  \"NAVER_CLIENT_SECRET\":\"$(printf %s '...' | base64)\"}}"
kubectl -n quizdeck rollout restart deploy/quizdeck
```

### Payload CMS 키 (ADR-0024)

`PAYLOAD_SECRET`(Payload 내부 토큰 서명 — 32자 이상 무작위)과 CMS 미디어용 R2 자격증명
4개도 같은 `quizdeck-auth` Secret 에 보관한다. 모두 `optional: true` — 없어도 파드는
기동하고, `PAYLOAD_SECRET` 부재 시 /cms 요청만 실패하며, R2 4종이 모두 있어야
`payload.config.ts` 가 R2 스토리지를 켠다(부재 시 로컬 디스크 폴백 — 휘발이라 dev 전용).

R2 는 백업(ADR-0021)과 같은 Cloudflare 계정에 **media 전용 버킷**을 따로 만들고
(Object Read & Write 스코프 토큰), 백업 자격증명과 섞지 않는다:

```sh
kubectl -n quizdeck patch secret quizdeck-auth --type merge -p "{\"data\":{
  \"PAYLOAD_SECRET\":\"$(openssl rand -base64 32 | tr -d '\n' | base64)\",
  \"R2_MEDIA_ENDPOINT\":\"$(printf %s 'https://<account-id>.r2.cloudflarestorage.com' | base64)\",
  \"R2_MEDIA_BUCKET\":\"$(printf %s 'quizdeck-media' | base64)\",
  \"R2_MEDIA_ACCESS_KEY_ID\":\"$(printf %s '...' | base64)\",
  \"R2_MEDIA_SECRET_ACCESS_KEY\":\"$(printf %s '...' | base64)\"}}"
kubectl -n quizdeck rollout restart deploy/quizdeck
```

## `db-credentials` (이슈 #4 가 생성)

DB VM postgres 접속 문자열(`DATABASE_URL`). 생성 절차는 #4 가 추가한
`infra/db-vm/k8s/README.md`(#4 머지 전에는 그 브랜치에만 존재).
better-auth 어댑터와 (V2) `/api/progress` 가 이 접속으로 postgres 에 붙는다.

## 비시크릿

`BETTER_AUTH_URL`(공개 도메인 `https://myquizdeck.com`)·`EMAIL_FROM`(발신주소
`QuizDeck <noreply@myquizdeck.com>`)은 시크릿이 아니라 Deployment 에 평문 env 로 둔다.
