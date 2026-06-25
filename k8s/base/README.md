# quizdeck Deployment 시크릿 (git 밖 — 절대 커밋 금지)

quizdeck Deployment(`k8s/base/deployment.yaml`)가 `env.valueFrom.secretKeyRef` 로
주입받는 시크릿이다. 값은 git 에 들어가지 않는다(`cloudflared-token` 과 동일 원칙).
Argo CD 의 kustomize 리소스에 포함되지 않으므로 **동기화 대상이 아니다 — 존재만 의존**한다.

## `quizdeck-auth` (이슈 #6)

better-auth 의 세션·JWT 서명 키. kubectl 호스트에서 1회:

```sh
kubectl -n quizdeck create secret generic quizdeck-auth \
  --from-literal=BETTER_AUTH_SECRET="$(openssl rand -base64 32)"
```

- 32자 이상 무작위 값이어야 한다(better-auth 가 저엔트로피 키를 경고).
- 키를 교체(rotate)하면 기존 세션 쿠키·발급된 JWT 가 모두 무효가 된다.

## `db-credentials` (이슈 #4 가 생성)

DB VM postgres 접속 문자열(`DATABASE_URL`). 생성 절차는 #4 가 추가한
`infra/db-vm/k8s/README.md`(#4 머지 전에는 그 브랜치에만 존재).
better-auth 어댑터와 (V2) `/api/progress` 가 이 접속으로 postgres 에 붙는다.

## 비시크릿

`BETTER_AUTH_URL`(공개 도메인 `https://myquizdeck.com`)은 시크릿이 아니라
Deployment 에 평문 env 로 둔다.
