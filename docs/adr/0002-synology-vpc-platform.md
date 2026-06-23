# 0002 — Synology를 k3s 기반 개인 VPC 플랫폼으로 (quizdeck = 첫 워크로드)

Status: accepted

## 결정

Synology를 일회성 앱 호스트가 아니라 **장기 개인 private cloud(VPC)** 로 취급한다. 배포 토폴로지:

- **substrate**: k3s(경량 실 k8s). app tier를 클러스터 안에 둔다.
- **ingress**: Traefik(k3s 기본 번들) — 역방향 프록시/라우팅(compose label 아닌 k8s ingress).
- **경계/IGW**: Cloudflare Tunnel — 아웃바운드 터널(인바운드 0, 홈 IP 은닉, DSM 80/443 충돌 회피).
- **data tier**: postgres를 **클러스터 밖**(Synology 컨테이너+볼륨)에 두고 "RDS 아날로그"로 취급.
- **배포**: GitOps(Argo CD) — 선언적 매니페스트가 단일 진실원천.
- **상위 층(L4~L6)**: 관측성(Prometheus/Grafana/Loki) → service mesh(Linkerd) → 관리 플레인(Meshery)을 **점진** 추가.

quizdeck는 정적 익스포트(`output:'export'`)를 버리고 **컨테이너화된 Next 서버**로 이 위에서 도는 첫 워크로드가 된다. [[0001-progressstore-seam]]의 RemoteApi adapter가 이 플랫폼의 API/postgres에 연결된다.

## 왜

- **학습 + 실용의 결합.** 사용자는 CNCF/AWS 자격을 공부 중이고(quizdeck 자체가 그 퀴즈앱) Synology를 cloud-native 박스로 키우려 한다. k3s는 실용 substrate이자 학습 도장을 겸하며 EKS로 1:1 이식된다.
- **이식성("Synology as VPC").** IGW→ingress→app→data tier 구조가 AWS(CloudFront/ALB→ALB→Fargate→RDS)로 그대로 매핑된다. 외부 postgres는 RDS가 EKS 밖에 있는 것과 같은 tier 분리 + 내구성.
- **진화적 플랫폼.** 워크로드(quizdeck)를 강제 함수로 먼저 돌리고, 각 상위 층은 가치 > 비용일 때만 올린다.

## 고려한 대안 (재제안 방지)

- **docker-compose + Traefik label** — "앱만 띄운다"면 최선이었다. 그러나 목적이 *장기 cloud-native 플랫폼 + 학습*으로 재정의되어 k3s를 택함. (단일 앱만 본다면 과설계가 맞다.)
- **nginx + 포트포워딩** — 인바운드 포트 개방·홈 IP 노출·DSM 80/443 충돌 비용. Traefik+Tunnel이 경계 보안·IaC·이식성에서 우위.
- **service mesh/Meshery를 처음부터** — mesh할 서비스가 없는 단계에서 과설계. 상위 층으로 미룬다(버리지 않음).

## 결과

- k3s를 DSM 맨몸에 올리면 커널/cgroup 마찰 → **k3s-in-VMM(가상머신) 또는 k3d**로 우회. 직접 작업 시 확정.
- `output:'export'` 폐기 → Dockerfile + k8s 매니페스트 + 외부 postgres 연결 필요(후속 구현).
- Cloudflare 의존성 1개 추가(ToS·가용성). quizdeck 규모엔 무부담.
- 로드맵·매핑 상세는 `docs/architecture/platform-roadmap.md`.
