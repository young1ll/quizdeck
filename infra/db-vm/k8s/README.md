# db-credentials Secret (git 밖 — 절대 커밋 금지)

DB 접속정보는 k8s **Secret**으로만 전달한다. 값은 git에 들어가지 않는다
(`cloudflared-token`과 동일 원칙 — `k8s/cloudflared/README.md`). 이 디렉토리는
"준비됐다"는 사실과 생성 절차만 담는다(이슈 #4 AC의 마지막 항목).

## 생성 (kubectl 호스트에서 1회)

`provision-postgres.sh`가 출력한 `DATABASE_URL`을 그대로 사용한다:

```sh
kubectl -n quizdeck create secret generic db-credentials \
  --from-literal=DATABASE_URL='postgres://quizdeck:<PASSWORD>@<DB_VM_LAN_IP>:5432/quizdeck'
```

- `<DB_VM_LAN_IP>` = DB VM의 OVS LAN IP (예: `192.168.68.x`). k3s VM이 게스트↔게스트로
  도달하는 주소다.
- SSL은 후속 하드닝(서버 인증서 설정 후 `?sslmode=require`). 지금은 신뢰 LAN 한정 + 방화벽으로
  격리하므로 평문 LAN 연결을 허용한다.

## 소비 (후속 이슈)

이 Secret은 better-auth 통합 이슈(#3 / V1)에서 quizdeck Deployment가
`env.valueFrom.secretKeyRef`로 주입한다 — better-auth postgres adapter +
`/api/progress`가 이 `DATABASE_URL`로 접속한다. 이 이슈(#4)의 범위는 **DB가 살아 있고
격리된 상태 + Secret로 전달될 준비**까지다(스키마/마이그레이션은 V1·V2).

Argo CD 동기화 대상에서 제외(존재만 의존) — `cloudflared-token`과 동일.
