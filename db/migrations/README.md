# DB 마이그레이션

better-auth 스키마(`0001`)와 앱 도메인 스키마(`0002~`)를 담는다. better-auth 테이블은
라이브러리 스키마를 그대로 따르고(직접 설계하지 않음), 앱 테이블은 손으로 작성한다.

## 무엇이 들어 있나

`0001_better_auth.sql` — better-auth + JWT 플러그인이 요구하는 테이블:

- `user` · `session` · `account` · `verification` — 코어(이메일+비밀번호, 세션, 자격증명)
- `jwks` — JWT/JWKS 플러그인용 키 저장(미래 IdP-lite 검증 경로, ADR-0003)

`0002_progress.sql` — Progress 동기화 저장소(이슈 #7 / ADR-0003):

- `progress(learner_id FK user, exam_key, snapshot jsonb, updated_at timestamptz, PK(learner_id, exam_key))`
  — (Learner, Exam) 단위 LWW 동기화의 서버측 백엔드. `/api/progress` Route Handler 가
  세션 Learner 로 스코프해 위임하고, `postgresProgressStore`(lib/progress-store-postgres.ts)가
  upsert/select 한다. 직접 설계한 도메인 테이블이라 better-auth CLI 가 만지지 않는다.

`0003_content.sql` — Question·Concept 콘텐츠(이슈 #26 / ADR-0005 A):

- `question(exam_key, qn, answer text[], content jsonb, PK(exam_key, qn))`,
  `concept(exam_key, svc, content jsonb, PK(exam_key, svc))` — 콘텐츠를 DB 단일 소스로.
  언어 의존 텍스트는 `content` jsonb 의 언어 슬롯(`{ko:{…}}`)에, 언어 무관 식별/검증 필드는
  컬럼에 둔다. Exam 페이지가 ISR 로 읽고(`lib/content.ts`), 어드민(#27)이 편집한다.

`0004_admin.sql` — better-auth admin 플러그인 스키마(이슈 #27 / ADR-0005 B):

- `"user"` 에 `role`·`banned`·`banReason`·`banExpires`, `"session"` 에 `impersonatedBy` 추가.
  `admin` role 만 `/admin`·콘텐츠 변경 API 를 통과한다(라이브러리 스키마, 0001 처럼).
  첫 admin 은 수동 지정: `update "user" set "role"='admin' where email='…';`
  > ⚠️ **`admin()` 플러그인이 `getSession` 시 `role`/`banned` 컬럼을 읽으므로, 0004 를 앱
  > 배포보다 먼저 적용해야 한다.** 안 하면 모든 세션 조회가 "column 없음"으로 throw → 인증 전체 중단.

`0005_annotation.sql` — Learner 인라인 주석(이슈 #29 / ADR-0005 D):

- `annotation(id, learner_id, exam_key, qn, lang, field, kind, memo, anchor jsonb, updated_at)`
  + `(learner_id, exam_key)` 인덱스. 밑줄·형광펜·메모를 quote+문맥 앵커로 콘텐츠에 참조만 건다.
  `/api/annotations` 가 모든 read/write 를 세션 learner_id 로 스코프한다.
  > ⚠️ **`/api/annotations` 가 `annotation` 테이블을 읽으므로 0005 를 앱 배포보다 먼저 적용**한다.

`0006_account_fk.sql` — 회원 탈퇴 cascade 보강(이슈 #36 / ADR-0006):

- `annotation.learner_id` 에 `user(id) on delete cascade` FK 추가(0005 엔 FK 없었음). 탈퇴
  (`deleteUser`) 시 Progress(0002, 이미 cascade)·session·account 와 함께 주석도 선언적으로 정리.
  > ⚠️ **`deleteUser` 플로우가 이 cascade 에 의존하므로 0006 을 앱 배포보다 먼저 적용**한다.
  > 기존 `annotation` 행의 learner_id 가 모두 유효해야 FK 추가가 성공한다(세션 learner_id 로만
  > 생성되어 충족 — 아직 탈퇴 기능이 없어 고아 행이 없다).

`0007_passkey.sql` — 패스키(WebAuthn) 로그인(이슈 #10 / ADR-0003 결정 2):

- `passkey(id, name, publicKey, userId FK user, credentialID, counter, deviceType, backedUp,
  transports, createdAt, aaguid)` + `userId`·`credentialID` 인덱스. `@better-auth/passkey` 플러그인의
  라이브러리 스키마(0001 처럼 CLI generate 산출). 같은 오리진에서 패스키 등록·인증을 받친다.
  > ⚠️ **`passkey()` 플러그인의 등록/로그인 API 가 이 테이블을 읽으므로 0007 을 앱 배포보다 먼저 적용**한다.

`0012_oauth_provider.sql` — OAuth 2.1 provider(wp-admin SSO IdP, ADR-0028):

- `oauthClient`·`oauthRefreshToken`·`oauthAccessToken`·`oauthConsent` 4종(`@better-auth/oauth-provider`
  라이브러리 스키마 — CLI generate 산출) + 인덱스 10개. 소비자는 wp-admin SSO 단일.
  > ⚠️ **`oauthProvider()` 플러그인이 이 테이블을 읽으므로 0012 를 앱 배포보다 먼저 적용**한다.
- **클라이언트 시드(수동, git 밖 — secret 포함)**: WP 클라이언트는 DB 행이다. 0012 적용 후 1회,
  kubectl 호스트(k3s-home)에서:

  ```sh
  SECRET=$(openssl rand -hex 32)
  # oauth-provider 는 clientSecret 을 SHA-256 → base64url(패딩 없음)로 해시 저장한다.
  HASH=$(printf %s "$SECRET" | openssl dgst -sha256 -binary | basenc --base64url | tr -d '=')
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "insert into \"oauthClient\"
    (\"id\",\"clientId\",\"clientSecret\",\"disabled\",\"skipConsent\",\"redirectUris\",
     \"tokenEndpointAuthMethod\",\"grantTypes\",\"responseTypes\",\"public\",\"type\",\"requirePKCE\",
     \"name\",\"scopes\",\"createdAt\",\"updatedAt\")
    values ('wordpress-admin','wordpress-admin','$HASH',false,true,
     '[\"https://wp.myquizdeck.com/wp-admin/admin-ajax.php?action=openid-connect-authorize\"]'::jsonb,
     'client_secret_post','[\"authorization_code\"]'::jsonb,'[\"code\"]'::jsonb,false,'web',false,
     'wp-admin SSO','[\"openid\",\"profile\",\"email\"]'::jsonb,now(),now());"
  # 평문 secret 은 WP 쪽 Secret 으로 (k8s/wp/README.md ⑤ — 같은 값이어야 한다)
  kubectl -n wordpress create secret generic wp-sso --from-literal=QD_SSO_CLIENT_SECRET="$SECRET"
  ```

  `requirePKCE=false` 는 WP 클라이언트(openid-connect-generic)가 PKCE 를 지원하지 않아서다
  (confidential client + client_secret_post 라 code flow 무결성은 유지 — ADR-0028).

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
psql "$DATABASE_URL" -f db/migrations/0002_progress.sql
psql "$DATABASE_URL" -f db/migrations/0003_content.sql
psql "$DATABASE_URL" -f db/migrations/0004_admin.sql   # 앱(admin 플러그인) 배포보다 먼저!
psql "$DATABASE_URL" -f db/migrations/0005_annotation.sql  # 앱(주석 API) 배포보다 먼저!
psql "$DATABASE_URL" -f db/migrations/0006_account_fk.sql  # 앱(탈퇴 플로우) 배포보다 먼저!
psql "$DATABASE_URL" -f db/migrations/0007_passkey.sql    # 앱(패스키 API) 배포보다 먼저!
psql "$DATABASE_URL" -f db/migrations/0012_oauth_provider.sql  # 앱(oauthProvider) 배포보다 먼저! + 클라이언트 시드(위 0012 절)
```

`0002` 의 `progress.learner_id` 가 `user(id)` 를 참조하므로 `0001` 다음에 적용한다.
신규(빈) DB 에 1회 적용하는 평범한 `CREATE TABLE` 이다(IF NOT EXISTS 아님 — 재적용은 에러).
이미 적용된 DB 에 스키마 변경분만 반영하려면 `npx @better-auth/cli migrate` 를 쓰거나
새 마이그레이션 파일의 변경 구문만 적용한다.

`0011_drop_legacy_content.sql` — 구 콘텐츠 저장소 폐기(ADR-0024 4단계):

- `question`·`concept`(0003)·`exam_icon_override`(0009·0010) drop. 콘텐츠 소스는 payload
  스키마(위 Payload 섹션)로 완전 이전 — 구 로더·seed·이관/검증 스크립트도 같은 PR 에서 제거됨.
  > ⚠️ **순서가 반대**: 추가형과 달리 **4단계 앱 배포 확인 후** 적용한다(후적용은 무해).

### 콘텐츠 seed (0003 적용 후, 배포 전) — ~~폐기됨 (ADR-0024)~~

> 이 섹션은 역사 기록이다. 콘텐츠 소스가 payload 스키마로 이전(0011)되면서 seed 파이프라인
> (`db/seed-content.mjs`·`db/seed-content.sql`)은 제거됐다 — 새 문제집은 /admin(CMS)에서 만든다.

`0003` 적용 후 `content/` JSON 을 DB 로 적재한다(idempotent — 재실행 안전). 두 방법:

```sh
# (a) node 가 있는 호스트(repo 체크아웃 필요)
DATABASE_URL="$DATABASE_URL" node db/seed-content.mjs

# (b) node 없이 — 생성된 seed SQL 을 psql 로(k3s-home 등, 마이그레이션과 같은 워크플로)
psql "$DATABASE_URL" -f db/seed-content.sql
```

`db/seed-content.sql` 은 `seed-content.mjs` 의 pg_dump 산출(선두 `truncate` 로 재적용 안전).
콘텐츠가 바뀌면 재생성한다(`#27` 어드민 편집 후엔 DB 가 소스 — 이 파일은 초기 시드용).

Exam 페이지가 런타임에 DB 에서 Question·Concept 을 읽으므로(ISR), **마이그레이션+seed 를
새 앱 배포보다 먼저** 하는 게 안전하다(seed 전엔 문항이 0 으로 보임). diagrams·q2svc·icons·
meta 는 파일 잔존이라 seed 대상이 아니다.

## Payload CMS 마이그레이션 (`db/payload-migrations/` — ADR-0024)

Payload 컬렉션 스키마(`payload` postgres 스키마 소유)는 수기 SQL 이 아니라 Payload 가
생성·적용한다 — **규율은 동일: 배포 전에 수동 적용**. 스키마 변경(컬렉션/필드 수정) 시:

```sh
# 1) 생성 — 로컬 임시 postgres(docker)를 향해 diff 를 뽑는다 (dev push 는 로컬 전용)
DATABASE_URL=postgres://… PAYLOAD_SECRET=dev-only pnpm payload migrate:create <이름>
# 2) 커밋 후, 배포 전에 DB VM 을 향해 적용 (kubectl 호스트 — node+repo 필요)
DATABASE_URL="$DATABASE_URL" PAYLOAD_SECRET=any pnpm payload migrate
```

첫 마이그레이션(`20260710_…_initial`)이 `CREATE SCHEMA IF NOT EXISTS "payload"` 를
포함한다(generator 는 스키마 생성을 만들어주지 않아 손으로 추가 — 재생성 시 유의).
적용 이력은 `payload.payload_migrations` 테이블이 추적한다(재실행 안전).

`0008_collection.sql` — 컬렉션(ADR-0022):

- `collection(id[client uuid], learner_id FK cascade, name, items jsonb[(examKey,qn)…], updated_at)`
  + `(learner_id)` 인덱스. Learner 큐레이션 cross-Exam 문항 세트 — `/api/collections` 가 모든
  read/write 를 세션 learner_id 로 스코프한다(annotation 패턴).
  > ⚠️ **`/api/collections` 가 이 테이블을 읽으므로 0008 을 앱 배포보다 먼저 적용**한다(0005·0007 선례).
