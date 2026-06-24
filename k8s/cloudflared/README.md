# cloudflared — Cloudflare Tunnel 커넥터

`myquizdeck.com` 공개 트래픽을 인바운드 포트 없이 받는 경계(L2). Argo CD가
이 디렉토리(`k8s/cloudflared`)를 동기화한다.

경로: 인터넷 → Cloudflare 엣지 → 터널 → **cloudflared(여기)** → Traefik(`kube-system`) → quizdeck.

## 토큰 Secret (git 밖 — 절대 커밋 금지)

터널 토큰은 Cloudflare Zero Trust 대시보드의 터널 `synology-k3s`에서 발급된다.
재구성 시 1회만 생성:

```sh
kubectl -n cloudflare create secret generic cloudflared-token \
  --from-literal=token='<TUNNEL_TOKEN>'
```

## 공개 호스트명 라우팅

대시보드 측 설정(remotely-managed 터널). Public Hostname `myquizdeck.com`
→ Service `http://traefik.kube-system.svc.cluster.local:80` (Host 보존 → Traefik 라우팅).
