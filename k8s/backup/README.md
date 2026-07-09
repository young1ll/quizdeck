# db-backup — 오프사이트 논리 백업 (ADR-0021)

data tier(별도 DB VM postgres)를 **다른 실패 도메인**(Cloudflare R2)으로 매일 밀어, 단일
Synology 박스 loss = 전손 위험을 닫는다. 근거·트리거 프레임워크는
[ADR-0021](../../docs/adr/0021-aws-migration-triggers-and-offsite-backup.md).

경로: `CronJob(quizdeck ns)` → `pg_dump -Fc "$DATABASE_URL"` → `mc pipe` → **R2 버킷**.
이 논리 덤프는 **durability(지금)** + **관리형 postgres 이전 리허설/seam 증명(나중)** 을 겸한다.

## 이 디렉터리

| 파일 | 관리 | 무엇 |
|---|---|---|
| `cronjob.yaml` + `kustomization.yaml` | **GitOps** (Argo App `backup`) | 매일 pg_dump→R2 |
| 아래 bootstrap 1~3 | **명령형 (git 밖)** | R2 버킷·lifecycle·자격 Secret |
| 복원 리허설 | 손작업 | seam 증명 + RTO 측정 |

## 파라미터

| 값 | 기본 | 의미 |
|---|---|---|
| schedule | `0 18 * * *` (UTC) = KST 03:00 | 매일 1회. RPO ≈ 24h(Progress 는 local-first라 클라가 일부 재-push) |
| 보관 | 30일 롤링 | R2 lifecycle 규칙(아래 2) |
| 이미지 | `postgres:17-alpine` | pg_dump client major ≥ server major(DB VM=pg16) |

---

## Bootstrap (한 번, 순서대로)

### 1. R2 버킷 생성

Cloudflare 대시보드 → R2 → **Create bucket** `quizdeck-backups`(지역 기본).
계정 R2 엔드포인트를 적어둔다: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.

### 2. 30일 lifecycle(보관 로테이션)

버킷 → Settings → **Object lifecycle rules** → 규칙 추가: *Delete objects* after **30 days**.
(잡이 아니라 버킷이 로테이션을 소유 — 잡은 쓰기만.)

### 3. R2 API 토큰 → k8s Secret

R2 → **Manage R2 API Tokens** → *Object Read & Write*(버킷 `quizdeck-backups` 한정 권장) 토큰
생성 → Access Key ID / Secret Access Key 확보.

```bash
kubectl -n quizdeck create secret generic r2-backup \
  --from-literal=R2_BUCKET='quizdeck-backups' \
  --from-literal=R2_ENDPOINT='https://<ACCOUNT_ID>.r2.cloudflarestorage.com' \
  --from-literal=R2_ACCESS_KEY_ID='<access-key-id>' \
  --from-literal=R2_SECRET_ACCESS_KEY='<secret-access-key>'
```

### 4. 배포 (GitOps) + 즉시 1회 실행 검증

```bash
kubectl apply -f ../argocd/backup-application.yaml   # Argo 가 CronJob sync
# 스케줄을 기다리지 않고 지금 한 번 돌려 검증:
kubectl -n quizdeck create job --from=cronjob/db-backup db-backup-manual
kubectl -n quizdeck logs job/db-backup-manual -f    # "backup ok: r2/quizdeck-backups/..." 확인
```

R2 대시보드에 `quizdeck-<타임스탬프>.dump` 객체가 생겼는지 확인.

---

## 복원 리허설 (= seam 증명 · RTO 측정) — 반드시 1회

백업은 **복원을 검증하기 전엔 백업이 아니다**. 최신 덤프를 **throwaway postgres** 로 복원해
(a) 덤프가 온전한지, (b) `DATABASE_URL` 만 바꾸면 앱이 붙는지(= 이식성 seam), (c) box-loss **RTO**
를 잰다. 이 RTO 가 ADR-0021 러ung 1 의 "RTO 불용" 트리거의 측정 기준이 된다.

```bash
# 1) 최신 덤프 내려받기 (mc alias 는 위 자격으로)
mc alias set r2 "$R2_ENDPOINT" "$R2_ACCESS_KEY_ID" "$R2_SECRET_ACCESS_KEY"
LATEST=$(mc ls r2/quizdeck-backups/ | awk '{print $NF}' | sort | tail -1)
mc cp "r2/quizdeck-backups/$LATEST" /tmp/restore.dump

# 2) throwaway postgres 로 복원 (로컬 docker)
docker run -d --name pg-restore -e POSTGRES_PASSWORD=x -p 55432:5432 postgres:17-alpine
createdb -h localhost -p 55432 -U postgres quizdeck   # PGPASSWORD=x
pg_restore -h localhost -p 55432 -U postgres -d quizdeck --no-owner /tmp/restore.dump

# 3) 온전성 확인 + 앱을 이 DB 로 (seam 증명)
psql -h localhost -p 55432 -U postgres -d quizdeck -c \
  'select count(*) from progress; select count(*) from "user"; select count(*) from question;'
# 로컬 앱을 DATABASE_URL=postgres://postgres:x@localhost:55432/quizdeck 로 띄워 붙는지 확인
docker rm -f pg-restore
```

> 리허설로 잰 RTO(다운로드+복원+검증 총 시간)를
> [`platform-roadmap.md`](../../docs/architecture/platform-roadmap.md) 체크리스트에 기록한다.

## AWS 이전과의 관계 (ADR-0021)

이 덤프가 곧 러ung 1 트리거가 켜질 때 **관리형 postgres(RDS/Neon/Supabase)로 복원할 바로 그
아티팩트**다 — 위 리허설의 목적지만 throwaway → 관리형으로 바꾸면 된다. AWS 이전을 미리 하지 않고
seam 이 싸다는 걸 증명만 한다("미리 사지 않음", ADR-0001).
