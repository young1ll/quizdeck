# ArgoCD UI — Tailscale 전용 노출 (ADR-0020)

배포 조망(CD)의 정본인 ArgoCD UI 를 **tailnet 에서만** 도달 가능하게 한다. 인앱 대시보드를 짓지
않고 이미 있는 도구를 도달 가능하게 하는 결정의 근거는 [ADR-0020](../../docs/adr/0020-argocd-tailnet-visibility.md).

경로: `(tailnet) argocd.myquizdeck.com` → **Cloudflare grey-cloud(DNS-only)** → VM Tailscale IP
→ Traefik(websecure, DNS-01 인증서) → `argocd-server`(`--insecure`).

## 이 디렉터리

| 파일 | 관리 | 무엇 |
|---|---|---|
| `ingressroute.yaml` + `kustomization.yaml` | **GitOps** (Argo App `argocd-server-expose`) | Host 라우팅 + TLS 종단 |
| `scripts/verify-argo-exposure.sh` | 명령형 | internet-closed / tailnet-open / 무회귀 pass/fail 프로브 |
| 아래 bootstrap 1~5 | **명령형 (git 밖)** | Argo/Traefik 자기-파라미터·Cloudflare·Secret — Argo 가 자기 server 를 sync 하면 self-lockout footgun 이라 뺐다 |

> 값(토큰)은 **git 밖**. `cloudflared-token`·`db-credentials` Secret 선례와 동일.

---

## Bootstrap (박스에서 한 번, 순서대로)

전제: `kubectl` 이 k3s 클러스터를 가리킨다(타넷 SSH → `sudo k3s kubectl` 또는 kubeconfig).
VM Tailscale IP 확인: VM 에서 `tailscale ip -4` (로드맵 기록값 `100.81.230.113`).

### 1. Cloudflare grey-cloud DNS 레코드

Cloudflare 대시보드(zone `myquizdeck.com`) → DNS → **Add record**:

- Type `A` · Name `argocd` · IPv4 `100.81.230.113`(= VM Tailscale IP) · **Proxy status: DNS only(회색 구름)**.

> **주황(Proxied) 절대 금지.** 주황이면 CF 엣지→터널로 프록시돼 **인터넷에 열린다**(불변식 위반).
> 회색은 공개 A 레코드가 라우팅 불가한 CGNAT 100.x 를 가리켜 tailnet 밖에선 도달 불가.
> 프로브 단언 1 이 이 규율(grey≠orange)을 매번 검증한다.

### 2. DNS-01 용 Cloudflare API 토큰 → Traefik Secret

Cloudflare → My Profile → API Tokens → **Zone · DNS · Edit** (zone `myquizdeck.com`) 토큰 생성.

```bash
kubectl -n kube-system create secret generic cloudflare-dns-token \
  --from-literal=CF_DNS_API_TOKEN='<발급 토큰>'
```

### 3. Traefik certresolver(DNS-01) — HelmChartConfig

k3s Traefik 에 ACME DNS-01 리졸버를 붙인다. `acme.json` 을 영속화하지 않으면 재시작마다 재발급 →
Let's Encrypt rate limit 위험이라 `persistence` 를 켠다.

```yaml
# /var/lib/rancher/k3s/server/manifests/traefik-config.yaml (박스에 배치 → k3s 가 자동 적용)
apiVersion: helm.cattle.io/v1
kind: HelmChartConfig
metadata:
  name: traefik
  namespace: kube-system
spec:
  valuesContent: |-
    persistence:
      enabled: true
      size: 128Mi           # acme.json 저장
    certificatesResolvers:
      cloudflare:
        acme:
          email: goooglecho01@gmail.com
          storage: /data/acme.json
          dnsChallenge:
            provider: cloudflare
    env:
      - name: CF_DNS_API_TOKEN
        valueFrom:
          secretKeyRef:
            name: cloudflare-dns-token
            key: CF_DNS_API_TOKEN
```

적용 확인: `kubectl -n kube-system rollout status deploy/traefik`.

### 4. argocd-server 를 `--insecure` 로

Traefik 이 TLS 를 종단하므로 argocd-server 는 평문 HTTP 로 둔다(자기 self-signed TLS 이중화 회피).

```bash
kubectl -n argocd patch configmap argocd-cmd-params-cm --type merge \
  -p '{"data":{"server.insecure":"true"}}'
kubectl -n argocd rollout restart deploy/argocd-server
```

### 5. IngressRoute 배포 (GitOps)

Argo App 을 한 번 적용하면 이후 `k8s/argocd-server/` 변경은 Argo 가 자동 sync 한다.

```bash
kubectl apply -f ../argocd/argocd-server-expose-application.yaml
# 확인:
kubectl -n argocd get application argocd-server-expose
kubectl -n argocd get ingressroute argocd-server
```

---

## 검증

```bash
CF_API_TOKEN='<Zone DNS Read 토큰>' ./scripts/verify-argo-exposure.sh
```

세 단언(ADR-0020): **① grey-cloud(internet-closed) · ② tailnet-open + 유효 인증서 · ③ 무회귀**.
추가로 **폰 셀룰러(tailnet 밖)** 에서 `curl https://argocd.myquizdeck.com/` 이 연결 실패해야 함(효과 확인).

브라우저: tailnet 에서 `https://argocd.myquizdeck.com` → 초록 자물쇠 + Argo 로그인(admin). 초기 비번:
`kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d`.

> 실행 완료 후 `verify-argo-exposure.sh` **ALL PASS** 를 `docs/architecture/platform-roadmap.md` 체크리스트에 기록한다(DB VM 키트 관례).

## 남은 것 (범위 밖 — ADR-0020)

- **Argo CLI(gRPC)**: 브라우저 UI 전용. CLI 는 Traefik gRPC-Web 미들웨어 추가 필요.
- **오프-tailnet(폰) 접근**: 의도적 불가(인바운드 0 유지). 필요해지면 CF Access 재고(불변식 트레이드).
- 미래 내부 서비스(`grafana.`·`meshery.`)는 이 패턴(grey-cloud→Tailscale-IP + DNS-01) 재사용.
