# db-vm — 격리된 postgres data tier (이슈 #4)

"Synology as VPC"의 **data tier**를 별도 VM(`db-home`)으로 띄운다. postgres를 k3s
클러스터 밖에 두는 **RDS 아날로그**이자, DB 수명을 k3s 재설치와 분리하기 위함이다
([ADR-0002](../../docs/adr/0002-synology-vpc-platform.md) ·
[ADR-0003](../../docs/adr/0003-auth-and-progress-sync.md)).

**불변식:** postgres는 어디서도 인터넷에 직접 노출되지 않는다. k3s VM에서
게스트↔게스트(OVS LAN)로만 접속 가능하고, 호스트·인터넷·그 외 tailnet에서는 막힌다.

이 디렉토리는 **재현 가능한 프로비저닝 키트**다. 실제 박스 실행은 아래 절차를 따른다.
이 이슈의 범위는 *DB가 살아 있고 올바르게 격리된 상태 + Secret 전달 준비*까지다 —
스키마/테이블(better-auth 마이그레이션 · `progress`)은 V1·V2에서 만든다.

## 구성

```
infra/db-vm/
├── autoinstall/        # Ubuntu 24.04 무인 설치 시드 (cidata)
│   ├── user-data       #   OS + postgres·ufw + SSH (placeholders 치환 후 사용)
│   ├── meta-data
│   └── README.md       #   시드 디스크 빌드 + DSM VMM 절차
├── scripts/
│   ├── provision-postgres.sh   # 앱 role/DB · listen · pg_hba(k3s만) — 멱등
│   ├── configure-firewall.sh   # ufw: 5432는 k3s VM에서만 — 멱등
│   └── verify-isolation.sh     # AC를 실행 가능한 pass/fail로 (오픈/클로즈 검증)
├── k8s/README.md       # db-credentials Secret 생성법 (값은 git 밖)
└── .gitignore          # 생성 시크릿/시드 산출물 차단
```

## 파라미터 (환경 토폴로지)

| 변수 | 기본값 | 의미 |
|---|---|---|
| `K3S_VM_IP` | `192.168.68.55` | postgres에 접속 허용할 **유일한** 클라이언트(k3s-home의 OVS LAN IP) |
| `DB_VM_LAN_IP` | 자동검출(`hostname -I`) | 이 DB VM의 OVS LAN IP. `listen_addresses`·접속 URL·검증에 사용 |
| `APP_DB` / `APP_ROLE` | `quizdeck` | 앱 전용 DB·role (better-auth + progress가 쓸 대상) |
| `APP_PASSWORD` | 생성(role 신규 시) | 비우면 role 생성 시 32자 랜덤 생성, 출력만 됨(커밋 금지) |

> **`K3S_VM_IP`는 "DB가 실제로 보는 k3s 측 source IP"여야 한다** — pg_hba·ufw는 그 주소로
> 매칭한다. 게스트↔게스트 LAN에서 파드가 나가면 보통 노드 IP로 SNAT되므로 k3s-home의 노드
> IP `192.168.68.55`가 기본값이다(platform-roadmap.md). 확정 검증: provision 후 k3s VM(또는
> 파드)에서 한 번 접속하고 DB에서 `SELECT inet_client_addr();` 또는 로그의 source IP를 확인해
> 그 값으로 `K3S_VM_IP`를 맞춘다. Tailscale로 접속한다면 그 `100.x` 주소를 쓴다.

## 절차 (박스에서 실행)

1. **VM 생성** — [`autoinstall/README.md`](autoinstall/README.md): 시드 치환 → CIDATA
   디스크 빌드 → DSM VMM에서 `db-home` 생성(Default VM Network) → autoinstall → seed 분리.
2. **부팅 후 LAN IP 확인** — 라우터에서 정적 예약 권장. 그 IP가 `DB_VM_LAN_IP`.
3. **postgres 구성** — DB VM에서:
   ```sh
   sudo K3S_VM_IP=192.168.68.55 ./scripts/provision-postgres.sh
   ```
   출력된 `DATABASE_URL`을 [`k8s/README.md`](k8s/README.md)로 Secret 생성에 사용.
4. **방화벽** — DB VM에서:
   ```sh
   sudo K3S_VM_IP=192.168.68.55 ./scripts/configure-firewall.sh
   ```
5. **격리 검증** — 두 지점에서:
   ```sh
   # k3s VM에서 (성공해야 함)
   PGPASSWORD=<pw> ./scripts/verify-isolation.sh --expect open \
     --target <DB_VM_LAN_IP> --psql-user quizdeck --psql-db quizdeck
   # Synology 호스트(및 그 외)에서 (실패/타임아웃해야 함)
   ./scripts/verify-isolation.sh --expect closed --target <DB_VM_LAN_IP>
   ```

## 디스크 여유 (AC)

- 설치는 LVM 레이아웃이라 나중에 키울 수 있다. 확인:
  ```sh
  df -h /        # 루트 사용량
  sudo vgs; sudo lvs
  ```
- 부족하면 (VMM에서 가상 디스크 키운 뒤) 루트 LV 확장:
  ```sh
  sudo lvextend -l +100%FREE /dev/ubuntu-vg/ubuntu-lv
  sudo resize2fs /dev/ubuntu-vg/ubuntu-lv
  ```
  (k3s-home의 `lvextend` 메모와 동일 — platform-roadmap.md.)

## 백업 접근 (메모 수준, AC)

- **논리 백업(권장 시작점):** DB VM에서 cron으로
  `pg_dump -Fc quizdeck > /var/backups/quizdeck-$(date +%F).dump`. 4GB급 데이터엔 충분.
  보관 로테이션은 `find /var/backups -mtime +14 -delete` 수준.
- **VM 스냅샷:** DSM VMM의 VM 스냅샷으로 디스크 전체를 시점 보존(빠른 롤백용).
- **오프박스 사본:** 덤프를 Synology `/volume1`(여유 1.4T)로 주기 복사 → DSM Hyper Backup
  대상에 포함. 복구 리허설은 별도 시점에.
- 자동화/PITR(`pg_basebackup` + WAL 아카이브)은 가치 > 비용일 때 후속 도입.

## Acceptance criteria 매핑

| 이슈 #4 기준 | 이 키트에서 | 상태 |
|---|---|---|
| 전용 DB VM autoinstall 프로비저닝 + postgres 기동 | `autoinstall/*` | **PENDING 박스 실행** |
| 앱 전용 role + DB 생성 | `provision-postgres.sh` | **PENDING 박스 실행** |
| pg_hba·방화벽이 k3s VM에서만 허용 (psql 성공) | `provision-postgres.sh` + `configure-firewall.sh` → k3s VM에서 `verify-isolation.sh --expect open` | **PENDING 박스 실행** |
| 호스트에서 postgres 접속 불가 | `configure-firewall.sh`(default-deny + k3s/32만) → **Synology 호스트에서** `verify-isolation.sh --expect closed` | **PENDING 박스 실행** |
| 인터넷에서 postgres 접속 불가 | LAN 도구로 검증 불가 → **아키텍처로 강제**: 인바운드 포트 0(라우터 포트포워딩 없음·cloudflared 아웃바운드 터널만), DB VM은 인터넷에서 라우팅 불가능 + ufw default-deny. cloudflared는 80/443만 노출 | **불변식(검증 불요)** |
| 루트 디스크 여유 확인(+`lvextend` 메모) + 백업 접근 기록 | 위 "디스크 여유"·"백업 접근" 절 | **문서 완료** |
| DB 접속정보 git 밖 k8s Secret 전달 준비 | `k8s/README.md` (값 미커밋) | **준비 완료** |

> 박스 실행/검증을 마치면 `verify-isolation.sh`의 PASS 출력을
> [`platform-roadmap.md`](../../docs/architecture/platform-roadmap.md)에 기록한다.
