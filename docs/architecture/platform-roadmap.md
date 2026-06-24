# 플랫폼 로드맵 — Synology as VPC

> 살아있는 설계 문서. 결정 근거는 [ADR-0002](../adr/0002-synology-vpc-platform.md), 데이터 영속 seam은 [ADR-0001](../adr/0001-progressstore-seam.md).
> 아이콘 시각 다이어그램: [platform-diagram.html](./platform-diagram.html) (브라우저로 열기).

개인 Synology를 **장기 private cloud(VPC)** 로 키운다. quizdeck는 첫 워크로드. 학습 + 실용을 GitOps로 잇고, 플랫폼은 **워크로드 위에서 진화**시킨다.

## 불변식

- 외부로 통하는 경로는 **인터넷 → Cloudflare → 터널 → Traefik → Next** 한 줄뿐.
- **postgres는 어디서도 인터넷에 직접 노출되지 않는다.**
- 모든 변경은 **선언적·버전관리(GitOps)** — "배우기 = 하기".
- 각 상위 층은 독립적으로 가치 있고, **가치 < 비용 지점에서 멈춘다.**

## 토폴로지

```mermaid
flowchart TB
  U[인터넷 사용자] --> CF[Cloudflare Tunnel<br/>경계 · IGW · 인바운드 0]
  CF -. 아웃바운드 터널 .- CFD
  subgraph SYN["Synology · VPC 경계"]
    subgraph K3S["k3s 클러스터 · app tier"]
      CFD[cloudflared] --> TR[Traefik · ingress]
      TR --> NX[quizdeck · Next pod]
    end
    NX --> PG[(postgres · 클러스터 밖<br/>RDS 아날로그)]
    GIT[Git 레포] --> ARGO[Argo CD · GitOps]
    ARGO -. sync .-> K3S
  end
  classDef edge fill:#fff7ed,stroke:#f59e0b;
  classDef data fill:#fffbeb,stroke:#f59e0b;
  class CF edge
  class PG data
```

## 진화 로드맵

| 층 | 구성 | 목적 | 상태 |
|---|---|---|---|
| **L1** | k3s (+ 기본 Traefik) | 클라우드네이티브 substrate | 기반 |
| **L2** | Cloudflare Tunnel | 경계/IGW · 인바운드 0 · 홈 IP 은닉 | 지금 |
| **L3** | quizdeck(Next) + 외부 postgres + Argo CD | 첫 워크로드, GitOps ← **강제 함수** | 지금 |
| **L4** | Prometheus + Grafana + Loki | 관측성 (mesh보다 먼저) | 다음 |
| **L5** | Linkerd | service mesh · mTLS·골든메트릭 | 나중 |
| **L6** | Meshery | 관리 플레인 · Designs/Kanvas로 설계·운영·벤치마킹 | 나중 |

## Synology ↔ AWS 매핑 (이식성)

| 역할 | Synology (지금) | AWS (장래) |
|---|---|---|
| 인터넷 게이트웨이 | Cloudflare Tunnel | CloudFront / public ALB |
| ingress | Traefik (k3s 기본) | ALB / ingress controller |
| 오케스트레이션 | k3s | EKS |
| app tier | Next pod | Fargate / EKS pod |
| data tier | 외부 postgres 컨테이너+볼륨 | RDS (private subnet) |
| 격리 | namespace | VPC / account 분리 |
| 네트워크 정책 | NetworkPolicy | security group |
| 배포 | Argo CD (GitOps) | Argo CD on EKS / CodePipeline |

tier 구조가 동일하므로 바뀌는 건 각 칸의 구현뿐. Synology 셋업이 AWS VPC의 **리허설**이 된다.

## 환경 현황 — Synology `zero` (점검 2026-06-23)

| 항목 | 값 |
|---|---|
| 모델/OS | DSM **7.3.2** · x86_64 · 커널 **4.4.302**(구버전) |
| CPU/RAM | 4 스레드(가상화 vmx/svm 지원) · **9.6GB**(여유 ~8GB) |
| Docker | Container Manager 24.0.2 · 데몬 active |
| VMM | **미설치** (`/dev/kvm` 없음 — 설치 시 활성 가능) |
| Tailscale | **설치됨**(1.58.2) — 단 **로그아웃**(NeedsLogin) |
| 디스크 | /volume1 3.5T · 1.4T 여유 |
| Tailscale | **연결됨**(young1ll@github) — `zero`=**100.78.231.75**, `young-macbookpro`=100.64.213.97 |
| 접속(타넷·권장) | `ssh -p 8999 zdmin@100.78.231.75` (키 기반 검증됨) → `sudo` |
| 접속(인터넷·폐쇄 예정) | `ssh zdmin@young1ll.synology.me`(WAN 22→내부 8999, DDNS=49.161.146.228). ⚠️ 봇 프로빙 관측 |

**커널 4.4 함의 — k3s substrate 결정: `k3s-in-VMM` (k3d 탈락, 검증 완료 2026-06-23):**
- k3d로 클러스터 생성 시 k3s containerd가 **overlay-on-overlay 마운트 실패**(`failed to mount overlay ... no such device`) — 커널 4.4는 overlay-on-overlay 미지원(5.x부터).
- 워크어라운드 `--snapshotter=native`로 overlay 회피 → apiserver는 실제로 기동(직접 검증). 그러나 native의 전체-복사가 Synology HDD에서 **너무 느려 10분 타임아웃에도 "k3s is up and running" 미도달** → 실용 substrate 불가.
- 결론: **modern 커널 Linux VM(VMM) 안에서 k3s 실행**. cgroup v2·overlay 정상·빠름. ([[../adr/0002-synology-vpc-platform.md|ADR-0002]]의 미정 항목 해소.) k3d/kubectl 바이너리는 호스트에 남겨둠(향후 VM 클러스터 kubeconfig 접근용 kubectl).

## 직접 작업(협업) 진행

- [x] **기존 docker 컨테이너 정리** — 컨테이너 10·이미지 다수 전부 제거, **36.39GB 회수**. `/volume1/docker`는 `@eaDir`만 남김. (2026-06-23)
- [x] **원격 접속을 Tailscale로 이전** — 양단 연결, 키 기반 타넷 SSH(`100.78.231.75:8999`) 검증. (2026-06-23)
- [ ] **인터넷 SSH 노출 닫기** — 공유기에서 WAN:22→Synology 포워딩 제거(권장), 또는 DSM 방화벽으로 SSH(8999)를 LAN(192.168.0.0/16)+Tailscale(100.64.0.0/10)만 허용. *닫으면 현재 인터넷 경유 tmux 세션은 끊김 → 타넷으로 재접속.* 추가로 SSH 비밀번호 인증 끄고 키 전용 권장.
- [x] **k3s 설치 방식 확정** — k3d 검증 실패(overlay-on-overlay/속도) → **k3s-in-VMM 확정**. (2026-06-23)
- [x] **VMM 설치 + Linux VM 생성** — VMM 설치 후 VM **`k3s-home`**(Ubuntu 24.04.4, 2vCPU·4GB·30GB, OVS Default VM Network) 생성. OS 설치는 **로컬 cidata seed 무인 autoinstall**로(노VNC/시리얼 콘솔이 막혀 GRUB에 `autoinstall`+vfat seed disk(vdb) 주입). 커널 **6.8**·cgroup **v2**·LAN IP **192.168.68.55**. (2026-06-24)
- [x] **VM 안에 k3s 설치** — `curl -sfL https://get.k3s.io | sh -`. **k3s v1.35.5 노드 Ready(17초)**, 시스템 파드 전부 Running, **Traefik ingress = LoadBalancer 192.168.68.55:80/443**. (2026-06-24)
- [ ] **VM을 Tailscale 타넷에 올리기** — 현재 접속은 Mac→Synology(점프, 임시 개인키 `~zdmin/idk`)→VM(192.168.68.55, 키). Synology sshd가 `AllowTcpForwarding no`라 ProxyJump 불가 → VM에 Tailscale 설치하면 Mac에서 직접 접속 + **임시 키 제거**.
  - ⚠️ 미해결: VM→Synology호스트 네트워크 차단(OVS host-guest 격리; 호스트→VM은 REACHABLE). RemoteApi/외부 postgres 접근 시 고려.
  - LVM root LV가 14G(30G 디스크 중) — 필요 시 `lvextend`로 확장.
- [ ] **postgres 외부 구성** — 컨테이너 + 영속 볼륨, 클러스터에서 접근만.
- [ ] **quizdeck 컨테이너화** — `output:'export'` 폐기 → Dockerfile + k8s 매니페스트 + Argo CD 앱.
- [ ] **Cloudflare Tunnel 구성** — `cloudflared` + 호스트네임 → Traefik 라우팅.
- [ ] L4~L6은 L3가 실제로 돌고 난 뒤 착수.

작업 재개 시: tmux `syno` 세션(또는 `ssh zdmin@young1ll.synology.me` → `sudo -i`)에서 이어감.
