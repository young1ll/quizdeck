# DB 마이그레이션 (better-auth)

better-auth 의 스키마 마이그레이션이다(이슈 #6). 라이브러리 스키마를 그대로 따른다 —
직접 손으로 테이블을 설계하지 않는다.

## 무엇이 들어 있나

`0001_better_auth.sql` — better-auth + JWT 플러그인이 요구하는 테이블:

- `user` · `session` · `account` · `verification` — 코어(이메일+비밀번호, 세션, 자격증명)
- `jwks` — JWT/JWKS 플러그인용 키 저장(미래 IdP-lite 검증 경로, ADR-0003)

## 어떻게 생성했나

`lib/auth.ts` 설정을 introspect 해 better-auth CLI 가 SQL 을 뽑는다. 빈(또는 기존) DB 에
접속해 diff 를 계산하므로 **DATABASE_URL 이 가리키는 postgres 가 살아 있어야 한다**:

```sh
DATABASE_URL=postgres://… BETTER_AUTH_SECRET=… BETTER_AUTH_URL=… \
  npx @better-auth/cli generate --output db/migrations/0001_better_auth.sql -y
```

플러그인·필드를 바꾸면(소셜 V4, 패스키 V5 등) 다시 generate 해 새 `000N_*.sql` 로 커밋한다.

## DB VM postgres 에 적용

DB 접속정보는 k8s Secret `db-credentials` 의 `DATABASE_URL` 이다(생성 절차는 #4 가 추가한
`infra/db-vm/k8s/README.md` — #4 머지 전에는 그 브랜치에만 존재). kubectl 호스트에서 1회:

```sh
psql "$DATABASE_URL" -f db/migrations/0001_better_auth.sql
```

신규(빈) DB 에 1회 적용하는 평범한 `CREATE TABLE` 이다(IF NOT EXISTS 아님 — 재적용은 에러).
이미 적용된 DB 에 스키마 변경분만 반영하려면 `npx @better-auth/cli migrate` 를 쓰거나
새 마이그레이션 파일의 변경 구문만 적용한다.
