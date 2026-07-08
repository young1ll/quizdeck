# 0021 — AWS 이전은 날짜가 아니라 트리거 게이트(러ung) + durability 는 오프사이트 R2 백업으로 먼저

- 상태: Accepted — 그릴링 2026-07-08 (아키텍처 리뷰 인프라·가시성 · 후보 ①)
- 관련: [[0002-synology-vpc-platform.md|ADR-0002]]("Synology as VPC"·AWS 매핑·"가치 < 비용에서 멈춘다") · [[0001-progressstore-seam.md|ADR-0001]]("미리 사지 않음") · [[0003-auth-and-progress-sync.md|ADR-0003]](data tier = 클러스터 밖 postgres) · `docs/architecture/platform-roadmap.md` · `infra/db-vm/README.md`(백업 메모)
- 코드: `k8s/backup/**`(신규 — pg_dump→R2 CronJob + 런북) · `k8s/argocd/backup-application.yaml`(신규 Argo App)

## 맥락

"현재 Synology 가 핵심인데 **언제 AWS 로 이전/확장**해야 하나?" [[0002-synology-vpc-platform.md|ADR-0002]]은 tier→AWS 매핑을 이미 갖지만("장래") **언제**가 미정이다. 그릴링에서 두 사실이 드러났다:

1. **durability 구멍이 present tense.** data tier(별도 DB VM postgres)의 백업 3계층 — `pg_dump`(DB VM `/var/backups`)·VM 스냅샷(DSM VMM)·"오프박스 사본"(Synology `/volume1`) — 이 **전부 같은 물리 Synology 위**다(`infra/db-vm/README.md`). 오프사이트 사본이 실제로 없다. 실패 도메인 = 박스 하나: 디스크·정전·도난·화재·랜섬웨어 한 번이면 DB 와 모든 백업이 동시 소실. Progress·Annotation·`user`·**편집된 콘텐츠**는 오직 DB 에만 존재 → 진짜 irreplaceable.
2. **AWS 이전에 트리거가 없다.** app tier 는 50m CPU(홈박스 한계 아득), Cloudflare 엣지가 이미 전역 정적 가용성을 주고, origin(홈박스)만 SPOF 다. 사용자 현실 = **초기 실사용자**(다운타임 아쉽지만 SLA 없음).

즉 "언제 AWS?"의 정직한 답은 durability 와 얽혀 있으나 **durability 는 AWS 로 푸는 문제가 아니다** — 오프사이트 백업이 훨씬 싸고 정확한 레버다.

## 결정

### A. durability 는 오프사이트 R2 백업으로 먼저 (지금 · AWS 무관)

`pg_dump -Fc` → **Cloudflare R2**(egress 무료·S3 API) 를 **k8s CronJob**(GitOps)으로. 매일 1회·**30일 롤링**(R2 lifecycle)·**복원 1회 리허설**. `DATABASE_URL` 재사용, R2 자격은 git 밖 Secret(`db-credentials`·`cloudflared-token` 선례).

- **한 산출물이 두 목적을 겸한다.** 이 논리 덤프가 durability(지금)와, B 의 트리거가 켜질 때 **관리형 postgres 로 복원할 바로 그 덤프**(seam 증명/이전 리허설)를 겸한다. [[0001-progressstore-seam.md|ADR-0001]]의 `DATABASE_URL` 이식성 seam 은 매핑 표에만 있는 **가설**이었는데, 복원 리허설이 그걸 **real 로** 만든다(미리 이전하지 않고 증명만).
- 논리 덤프라 벤더 종속 0 — self-hosted·RDS·Neon·Supabase 어디로도 복원. R2 는 이미 Cloudflare 스택 위라 새 벤더 무추가.

### B. AWS 이전은 트리거 게이트 + 러ung (data tier 먼저)

"AWS"는 이분법이 아니라 러ung(사다리 단)이다. 각 단은 **관측 가능한 트리거**가 켜질 때만 오른다(날짜 아님).

| 러ung | 무엇 | 트리거(하나라도) |
|---|---|---|
| **1 — 관리형 DB**(data tier 먼저) | RDS(AWS-native·VPC 리허설 완성) 또는 Neon/Supabase(더 쌈, 같은 seam) | 운영 toil > 관리비용 · PITR 필요(결제·되돌릴 수 없는 데이터 추가) · 리허설로 잰 box-loss RTO 가 불용 |
| **2 — origin 이중화**(app tier, EKS 보다 쌈) | 값싼 always-on VPS(Fly/Hetzner/Lightsail)·둘째 노드 | 홈박스/ISP 다운이 사용자에게 반복해 아픔 · 당신이 pager 일 수 없음(여행·수면·근무 중 다운이 중요) |
| **3 — 풀 EKS/RDS** | AWS VPC 전면 | 진짜 scale(홈박스 CPU/mem 한계) · enterprise/SLA |

**반대 추(load-bearing).** 이 플랫폼의 *목적 자체*가 자기호스팅으로 cloud-native 를 배우는 것([[0002-synology-vpc-platform.md|ADR-0002]] "배우기 = 하기")이다. 관리형으로 옮기면 **학습 기반이 사라진다.** 그래서 정직한 이동 라인은 단순 비용이 아니라 **"운영비용 > (학습가치 + 호스팅 절감)"** 이다.

## 기각 대안

### 지금 RDS/EKS 로 전면 이전

**기각** — 트리거가 하나도 안 켜졌다(50m CPU·SLA 없음). durability 는 백업으로 충분하고, 자기호스팅의 학습 가치가 살아 있다. "미리 사지 않음"([[0001-progressstore-seam.md|ADR-0001]]).

### 날짜 기반 로드맵("N개월 뒤 AWS")

**기각** — 날짜는 관측 가능한 신호가 아니다. 러ung + 트리거는 "지금 옮겨야 하나?"에 매번 결정론적으로 답한다.

### durability 를 RDS 이전으로 해결

**기각** — RDS 의 값어치(관리형 PITR·multi-AZ·자동 오프사이트)는 오프사이트 cron-dump 를 *넘어선* 요구가 있을 때만 정당화된다. 지금 필요한 건 "박스 loss 생존"뿐이고 그건 R2 백업이 월 $0~1 로 준다.

### DSM Hyper Backup 으로 박스 통째 백업

**기각(정본으로는)** — 편하지만 VM 디스크 이미지라 포터블하지 않고(어떤 postgres 로도 복원 X) seam 리허설 가치가 없다. 병행은 가능하나 durability 의 **정본은 논리 덤프(A)**. (백업 메커니즘 그릴링에서 이미 다룸.)

## 결과

- durability 구멍이 즉시 닫힌다 — 박스가 통째 사라져도 R2 의 덤프가 살아남고, 복원 리허설이 RTO 를 측정된 값으로 만든다.
- AWS 결정이 **관측 가능한 트리거**로 명문화된다 — 미래 아키텍처 리뷰가 "언제 AWS?"를 재-litigate 하지 않고 이 러ung 을 본다.
- 백업 덤프가 **이전 리허설을 겸해** [[0001-progressstore-seam.md|ADR-0001]]의 이식성 seam 을 가설에서 proven 으로 올린다 — 실제 이전 없이.
- `docs/architecture/platform-roadmap.md`(백업 메모·AWS 매핑)·`infra/db-vm/README.md`(오프박스 = /volume1 은 오프사이트 아님) 갱신. CONTEXT.md 무변경 — 백업·이전 트리거는 운영 표면([[0017-admin-operational-surface.md|ADR-0017]]·[[0018-health-status-module.md|ADR-0018]] 선례).
- **박스 실행 대기**(DB VM 키트 관례) — R2 버킷·API 토큰·Secret·Argo App apply·**복원 리허설**은 손작업. 리허설로 잰 RTO 를 여기에 기록하면 러ung 1 의 "RTO 불용" 트리거가 측정 기준을 갖는다.
