# 0018 — health/status 모듈: liveness·readiness·status 3분할, readiness 는 공유 외부 DB 로 게이팅하지 않는다

- 상태: Accepted — 그릴링 2026-07-08 (아키텍처 리뷰 인프라·가시성 · 후보 A)
- 관련: [[0002-synology-vpc-platform.md|ADR-0002]](L4 관측성 — 이게 첫 관측 표면) · [[0001-progressstore-seam.md|ADR-0001]](adapter-as-param 관례) · [[0015-api-rsc-authorize-seam.md|ADR-0015]](withAdmin) · [[0017-admin-operational-surface.md|ADR-0017]](admin 허브가 status 를 끌어옴)
- 코드: `lib/health.ts`(신규) · `app/api/health/route.ts`(확장) · `app/api/ready/route.ts`(신규) · `app/api/status/route.ts`(신규) · `Dockerfile`·`.github/workflows/deploy.yml`(sha 배선) · `k8s/base/deployment.yaml`(probe)

## 맥락

[[0002-synology-vpc-platform.md|ADR-0002]]은 관측성 층(L4 Prometheus/Grafana/Loki)을 **미룬다**. 그동안 `/api/health` 는 `{status:'ok'}` 상수를 돌려주는 최대 shallow 엔드포인트였다(이슈 #3 — standalone 토대 증명용). 인터페이스는 "healthy" 를 약속하지만 구현은 아무것도 증명하지 않아 **data tier(클러스터 밖 postgres VM)에 blind** 하다. 게다가 런타임은 자기가 **어떤 sha 인지 모른다**(`.git` 은 `.dockerignore`, CI 는 sha 를 이미지 태그로만 계산) — 배포 가시성이 수동 curl 로 샌다.

아키텍처 리뷰는 순진하게 "readiness probe 가 DB 를 찔러 실제 서빙가능성을 반영하게 하자" 고 제안했다. 그러나 이는 **공유 외부 DB + `replicas:1`** 에서 안티패턴이다: postgres 는 모든 파드가 공유하는 단일 외부 의존이라, 죽으면 replica 를 아무리 늘려도 **전부 똑같이 무력**하다. readiness 를 DB 에 묶으면 게이팅이 라우팅할 곳이 없이 부분 저하를 **전면 503** 으로 키우고, 롤아웃을 wedge 하며, k8s/Argo 대시보드에 flapping 을 만든다.

## 결정

`/api/health` 하나를 **liveness·readiness·status 세 표면으로 가르고**, DB 진실은 traffic-gating probe 가 아니라 **관측 표면(status + 알림)** 에 둔다.

1. **`lib/health.ts` = deep 모듈.** 얇은 인터페이스 둘이 pool 설정·타이밍·에러→상태 매핑을 숨긴다.
   - `getVersion(): { sha }` — `process.env.BUILD_SHA ?? 'unknown'`.
   - `checkDb(q: Queryable): Promise<{ status:'up'|'down', latencyMs }>` — `select 1` 시도, 성공=up·실패=down, **절대 throw 안 함**(status 는 db down 이어도 200 으로 진단을 돌려줘야 한다).
   - 모듈-레벨 **전용 health `Pool`**(`max:2`, `connectionTimeoutMillis:2000`, `statement_timeout:2000`) — connect·query 를 pg 레벨에서 바운드해 **hang·누수 없이** 시간을 묶고, 공유 `lib/db` pool 은 무변경으로 둔다. `checkDb` 가 `Promise.race` 를 들 필요가 없어진다.

2. **세 라우트 = 얇은 어댑터.**
   | 라우트 | 역할 | 본문 | 노출 | DB |
   |---|---|---|---|---|
   | `GET /api/health` | liveness | `{ ok:true, sha }` | 공개 | ✗ |
   | `GET /api/ready` | readiness | `{ ready:true }` | 공개 | ✗ |
   | `GET /api/status` | 진단 | `{ sha, db:{status,latencyMs}, uptimeSec, startedAt, now }` | **admin**(`withAdmin`) | ✓ |
   절대 미노출: `DATABASE_URL`·호스트/포트·stack·env dump. sha 가 **공개**인 이유는 배포 게이트(아키텍처 리뷰 후보 C)가 **클러스터 밖 CI** 에서 기대 sha 를 폴링해야 하기 때문 — 이미지 태그·git 이 이미 공개라 무해하다.

3. **readiness 는 공유 외부 DB 로 트래픽을 게이팅하지 않는다.** `/api/ready`·`/api/health` 는 DB 를 부르지 않는다. DB 진실은 `/api/status`(admin, on-demand) 와 주기 알림(후보 C, `checkDb` 재사용)이 드러낸다. liveness 도 DB무관 → **DB 순단으로 파드가 절대 재시작되지 않는다**(캐스케이드 방지).

4. **sha 배선 = Docker ARG→ENV.** `Dockerfile` runtime 스테이지(무거운 build 뒤 → builder 캐시 유지)에 `ARG GIT_SHA=unknown` / `ENV BUILD_SHA=$GIT_SHA`. `deploy.yml` 의 `build-push-action` 이 `build-args: GIT_SHA=${{ steps.meta.outputs.tag }}` 전달. NEXT_PUBLIC 불필요(서버 라우트에서만 읽음).

5. **probe 재배선.** livenessProbe(**신설**) → `/api/health/`(period 20·failureThreshold 3·initialDelay 20 — `replicas:1` 이라 flapping 안 되게 관용, true hang 에만 재시작), readinessProbe 는 최종적으로 → `/api/ready/`, Docker HEALTHCHECK 는 `/api/health/` 유지. trailingSlash:true 라 probe 경로는 슬래시 포함. **롤아웃 순서 불변식**: probe 경로는 현재 도는 이미지에 존재해야 하므로, `/api/ready` 를 도입하는 첫 배포에선 readinessProbe 를 구·신 공통 `/api/health/` 에 두고, 새 이미지가 라이브로 확인된 뒤 **후속 커밋**에서 `/api/ready/` 로 옮긴다(구 이미지엔 `/api/ready` 부재 → 404 → NotReady → 전면 503 회피). liveness·HEALTHCHECK 는 `/api/health/`(구·신 공통)라 첫 배포부터 안전.

6. **seam = test surface.** `checkDb(q)` 는 두 어댑터 — prod=전용 pool, test=fake `{query}`(throws→down, rows→up) — 로 up/down 을 **실DB·jsdom 없이** 단위 검증([[0001-progressstore-seam.md|ADR-0001]] adapter-as-param 관례와 정합).

## 기각 대안

### readiness 가 DB down 시 503(NotReady)

정통 k8s. **기각** — 공유 외부 DB 라 게이팅이 라우팅할 곳이 없고, `replicas:1` 에서 DB 순단을 전면 503 으로 키우며 롤아웃을 wedge 한다. DB 상태는 **관측**의 문제이지 traffic-gating 의 문제가 아니다. (미래 아키텍처 리뷰가 이 안을 재제안하지 않도록 이 ADR 로 못박는다.)

### 단일 엔드포인트 + `?deep=1` 로 depth 조절

라우트 1개 유지. **기각** — 한 인터페이스가 machine probe(얕음·잦음)와 human 진단(리치·admin)이라는 두 소비자를 겸하면 인가·캐시·페이로드가 뒤섞인다. 3분할이 각 소비자에 하나씩 얇은 어댑터를 준다.

### readiness 가 매 period `select 1`(record-only, 항상 200)

**기각** — 결과가 200 에 영향을 안 주니 매 10s DB 왕복이 낭비이고, db 상태를 어딘가 따로 캐시/로그해야 한다. `checkDb` 를 `/status` + 알림 한 곳에만 두는 게 locality.

### 공유 `lib/db` pool 에 timeout 을 넣어 `checkDb` 단순화

근본 fix 지만 **이 ADR 범위 밖**. 전용 health pool 로 A 자기만 보호하고, 공유 pool 의 `connectionTimeoutMillis` 부재(다른 소비자의 잠복 hang)는 회귀 검증이 필요한 별도 결정으로 남긴다.

## 결과

- `/api/health` 가 blind 상수에서 deep 모듈로 — probe 가 role 별로 갈리고(liveness≠readiness), sha 노출이 배포 가시성(후보 C)의 게이트를, `checkDb` 재사용이 알림(후보 B/C)을, `/api/status` 의 db 상태가 SPOF 가시성(후보 D)·admin 허브(ADR-0017) status 카드를 먹인다. ADR-0002 의 **첫 관측 표면**.
- DB 순단 시 k8s 는 전면 503 이 아닌 "앱 up, 일부 저하" 를 유지하고, 파드는 재시작되지 않는다. 저하는 `/api/status`·알림으로 드러난다.
- CONTEXT.md 무변경 — health/status 는 운영 표면이라 학습 글로서리 밖([[0017-admin-operational-surface.md|ADR-0017]] 선례).
- 남은 잠복 이슈: 공유 `lib/db` pool 의 connect-timeout 부재. 후속 결정.
