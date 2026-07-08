# 0020 — 배포 가시성: 인앱 대시보드를 짓지 않고 ArgoCD UI 를 Tailscale 전용으로 노출한다

- 상태: Accepted — 그릴링 2026-07-08 (아키텍처 리뷰 인프라·가시성 · 후보 ②)
- 관련: [[0002-synology-vpc-platform.md|ADR-0002]](L4 관측성·"인바운드 0" 불변식) · [[0018-health-status-module.md|ADR-0018]](status 카드는 앱-생존, 배포 진실은 별도) · [[0019-structured-logging-admin-status.md|ADR-0019]](admin 허브 status 카드) · `docs/architecture/platform-roadmap.md`
- 코드: `k8s/argocd-server/**`(신규 — IngressRoute + 런북 + 프로브) · `k8s/argocd/argocd-server-expose-application.yaml`(신규 Argo App) · `app/admin/page.tsx`(INFRA 링크 1개)

## 맥락

배포 후 "내 커밋이 라이브에 반영됐나?" 를 묻는 표면이 흩어져 있다. admin status 카드([[0019-structured-logging-admin-status.md|ADR-0019]])는 **라이브 sha 만** 보여 기대 sha 와 비교하지 못하고, 롤아웃 진행/히스토리에는 blind 하다. 실제 요구는 더 넓었다: **CI/CD 조망**(진행·히스토리·롤백·health) — Jenkins 류 대시보드.

핵심 관찰: 그 조망의 정본은 **이미 두 성숙한 도구가 계산·저장**하고 있다.

- **CI**(test→build→push→bump→롤아웃 게이트) = **GitHub Actions** — run 히스토리·per-step 로그·타이밍·pass/fail.
- **CD**(sync→rollout→health) = **ArgoCD** — sync/revision 히스토리·`Progressing/Synced`·리소스 health 트리·**롤백**.

즉 결핍은 *집약(one pane)* 이 아니라 **도달성**이다: ArgoCD UI 가 어떤 ingress 도 없어 `kubectl port-forward` 로만 접근된다. 아키텍처 리뷰의 순진한 제안("status 카드를 rollout 뷰로 심화")은 라이브 sha 만 아는 파드 안에서 **기대 sha 를 외부(git/Argo)에서 끌어와야** 하고, 나아가 "CI/CD 패널을 앱에" 는 세 성숙한 도구를 얕게 재현(GitHub PAT·Argo 토큰을 앱에 심고, 진실은 Argo 에 있는데 앱이 미러링 — locality 0)하는 함정이다.

## 결정

**인앱 CI/CD 대시보드를 짓지 않는다.** 이미 있는 정본 도구를 **도달 가능**하게 하고 admin 허브에서 링크한다. status 카드([[0018-health-status-module.md|ADR-0018]])는 "앱 생존 + sha" 즉답으로 **무변경** 유지 — 관측(배포)은 Argo, 생존은 카드로 **locality 를 가른다**.

1. **ArgoCD UI 를 Tailscale 전용으로 노출.** `argocd.myquizdeck.com` → Cloudflare **grey-cloud(DNS-only)** A 레코드 → VM Tailscale IP(`k3s-home`=100.81.230.113) → Traefik **IngressRoute** → argocd-server. Cloudflare Tunnel 은 `myquizdeck.com` Host 만 포워딩하고 grey-cloud 라 공개 A 레코드가 라우팅 불가한 CGNAT 100.x 를 가리키므로, **인터넷 경로가 구성상 닫힌다** — [[0002-synology-vpc-platform.md|ADR-0002]]의 "인바운드 0" 불변식 유지.
2. **진짜 인증서.** Traefik **ACME DNS-01**(기존 Cloudflare 토큰 재사용)로 `argocd.myquizdeck.com` 에 Let's Encrypt 인증서를 발급 — IP 도달과 무관하게 TXT 로 증명하니 A 레코드가 사설 100.x 여도 유효하다. argocd-server 는 `--insecure`(HTTP)로 두고 Traefik 이 그 인증서로 TLS 를 종단한다. 와이어는 WireGuard(Tailscale)가, 종단은 Traefik 이 이중으로 보호.
3. **인증 = Argo admin 로그인.** anonymous 는 켜지 않는다. tailnet 이 네트워크 경계, Argo 로그인이 권한 경계. 조회·뮤테이션(sync·롤백) 모두 로그인 뒤 — 단일 사용자라 마찰 무해.
4. **GitOps 경계.** IngressRoute(새 리소스) 만 git + **새 Argo App `argocd-server-expose`** 가 관리(cloudflared 가 별도 App 인 선례와 정합). `argocd-cmd-params-cm` 의 `server.insecure` 토글·Traefik certresolver·grey-cloud DNS·DNS-01 토큰 Secret·verify 프로브는 **명령형 bootstrap + README**(`k8s/argocd-server/README.md`). 이유: **Argo 가 자기 server 파라미터를 관리하면 self-lockout footgun** — 잘못된 sync/prune 한 번이 Argo server 를 잠가 스스로를 고칠 손잡이를 잃는다. 일회성 토글은 명령형-once 가 안전하고 Argo 설치가 이미 명령형인 선례와도 맞다.
5. **프로버빌리티 = 테스트 표면.** `k8s/argocd-server/scripts/verify-argo-exposure.sh` 가 세 단언을 pass/fail 로([[../../infra/db-vm/scripts/verify-isolation.sh|verify-isolation.sh]] 형식 계승): (a) Cloudflare API 로 레코드 `proxied==false`(grey) → **internet-closed**(원인 단언 — orange 로 뒤집히면 즉시 fail), (b) tailnet 에서 `200/3xx + 유효 인증서` → **tailnet-open**(효과), (c) `myquizdeck.com` 은 여전히 quizdeck → **회귀 없음**(IngressRoute 우선순위가 catch-all 을 안 깼는지). 자동화 밖: 폰 셀룰러(tailnet 밖) 수동 스팟체크.
6. **범위 = 브라우저 UI 전용.** Argo **CLI**(gRPC)는 Traefik gRPC-Web 미들웨어가 추가로 필요 — "조망 대시보드" 목표 밖이라 미룬다.

## 기각 대안

### 인앱 CI/CD 패널 (Next 파드가 Actions/Argo API 를 fetch 해 재렌더)

**기각** — 세 성숙한 도구를 인터페이스가 거의 그만큼 넓은 얇은 wrapper 로 재현하고, GitHub PAT·Argo 토큰을 앱에 심으며, 진실은 Argo 에 있는데 앱이 미러링(locality 0). deletion test 불통과: 지워도 복잡도가 모이지 않고 이동한다.

### 집약 한 판 (Grafana L4 / Meshery L6 로 CI/CD·메트릭·로그 통합)

로드맵에 이미 있음([[0002-synology-vpc-platform.md|ADR-0002]] L4~L6). **미룸(기각 아님)** — 아직 트리거(한 판이 아쉬운 실제 순간)가 없다. "가치 < 비용에서 멈춘다."

### subdomain → Cloudflare Tunnel + Access (인터넷 노출 + 인증 게이트)

폰에서 Tailscale 없이 볼 수 있어 매력적. **기각** — "인터넷 → Cloudflare → 터널 한 줄뿐 / 인바운드 0" 불변식을 깬다(공개 ingress 경로가 하나 더 생기고 유일 방벽이 Access 정책 하나). 오프-tailnet 접근이 명시 요구가 되면 그때 재고.

### MagicDNS 이름(`k3s-home.<tailnet>.ts.net`) 직접

공개 DNS footprint 0 로 가장 순수. **기각(약)** — 이름이 못생겼고 진짜 인증서가 즉시 안 나온다. grey-cloud subdomain 이 tailnet 전용·인바운드 0 을 동일 유지하면서 예쁜 이름 + 초록 자물쇠 + **미래 내부 서비스 재사용 패턴**(`grafana.myquizdeck.com`·`meshery.myquizdeck.com`)을 준다. 대가는 공개 DNS 에 CGNAT 100.x 노출뿐(라우팅 불가라 실질 무해).

### anonymous read-only (열면 로그인 없이 조망)

마찰 0 관찰. **기각(택 안 함)** — 단일 사용자라 admin 로그인 마찰이 무시할 만하고, anonymous 를 켜면 tailnet 확장 시 조회가 새는 표면이 생긴다. tailnet 이 커지는 시점이 SSO 로 조일 트리거.

## 결과

- 배포 조망이 **정본 도구(Actions + Argo)로 즉시** 생긴다 — 롤백·sync 히스토리·health 트리까지, 인앱 재구현 0. status 카드는 앱-생존 즉답으로 남아 **관측/생존 locality 가 갈린다**.
- **인바운드 0 유지** — grey-cloud 가 인터넷 라우팅을 구성상 닫고, verify 프로브가 그 규율(grey≠orange)을 **가정이 아니라 검증**으로 지킨다.
- **재사용 패턴 확립** — grey-cloud→Tailscale-IP + Traefik DNS-01 은 다음 내부 서비스(Grafana·Meshery, L4~L6)에 그대로 재적용된다. "Synology as VPC" 진화에 정합.
- CONTEXT.md 무변경 — Argo 노출·배포 가시성은 운영 표면이라 학습 글로서리 밖([[0017-admin-operational-surface.md|ADR-0017]]·[[0018-health-status-module.md|ADR-0018]]·[[0019-structured-logging-admin-status.md|ADR-0019]] 선례).
- **박스 실행 대기** — DB VM 키트(#4)처럼 git 은 재현 가능 키트(IngressRoute·Argo App·런북·프로브)를 담고, 클러스터 apply·Cloudflare 레코드·프로브 실행은 tailnet 에서 손으로. 실행 후 `verify-argo-exposure.sh` PASS 를 런북에 기록한다.
- 남은 것: Argo CLI(gRPC-Web), 오프-tailnet(폰) 접근, 초록 자물쇠가 아닌 표시상 경고(현재 설계는 진짜 인증서라 해당 없음).
