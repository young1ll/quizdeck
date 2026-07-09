#!/usr/bin/env bash
# verify-argo-exposure.sh — runnable acceptance checks for the Tailscale-only
# ArgoCD UI exposure (ADR-0020). Mirrors infra/db-vm/scripts/verify-isolation.sh:
# it encodes the acceptance criteria as pass/fail probes.
#
# Run from your Mac while ON the tailnet:
#
#   CF_API_TOKEN=<zone-DNS-read token> ./verify-argo-exposure.sh
#
# Asserts three things (exit 0 only if all PASS):
#   1. internet-closed (cause)  — the Cloudflare record is grey-cloud (proxied=false).
#                                 If someone flips it to orange, ArgoCD is on the public
#                                 internet — this catches it. This is the safety property.
#   2. tailnet-open   (effect)  — https://argocd.myquizdeck.com/ answers 2xx/3xx with a
#                                 VALID cert (no -k). Proves routing + real Let's Encrypt cert.
#   3. no regression            — https://myquizdeck.com/api/health/ still serves quizdeck.
#                                 (IngressRoute priority did not steal the catch-all.)
#
# Manual spot-check (outside this script): from a phone on CELLULAR (off-tailnet),
# `curl https://argocd.myquizdeck.com/` must fail to connect — proves the effect end-to-end.
set -euo pipefail

HOST="${HOST:-argocd.myquizdeck.com}"
ZONE="${ZONE:-myquizdeck.com}"
PUBLIC_HOST="${PUBLIC_HOST:-myquizdeck.com}"
TIMEOUT="${TIMEOUT:-8}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --host)        HOST="$2"; shift 2 ;;
    --zone)        ZONE="$2"; shift 2 ;;
    --public-host) PUBLIC_HOST="$2"; shift 2 ;;
    -h|--help)
      echo "usage: CF_API_TOKEN=<token> $0 [--host H] [--zone Z] [--public-host P]" >&2
      exit 2 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

fail=0
pass() { echo "PASS: $1"; }
bad()  { echo "FAIL: $1" >&2; fail=1; }

cf_api() {
  curl -sS --max-time "$TIMEOUT" -H "Authorization: Bearer ${CF_API_TOKEN}" \
    -H "Content-Type: application/json" "https://api.cloudflare.com/client/v4/$1"
}

# jq 있으면 그걸로, 없으면 grep 폴백(레코드 1개 가정).
json_field() { # $1=json $2=key  → value (jq 우선)
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$1" | jq -r "$2"
  else
    printf '%s' "$1" | grep -o "\"${2##*.}\":[^,}]*" | head -1 | sed 's/.*://; s/"//g; s/ //g'
  fi
}

echo "== ArgoCD 노출 검증 — host=${HOST} zone=${ZONE} =="

# ── 단언 1: internet-closed (grey-cloud) ─────────────────────────────
if [[ -z "${CF_API_TOKEN:-}" ]]; then
  bad "CF_API_TOKEN 미설정 — grey-cloud(internet-closed)를 검증할 수 없다. Zone DNS Read 토큰을 주라."
else
  zid_json="$(cf_api "zones?name=${ZONE}")"
  zone_id="$(json_field "$zid_json" '.result[0].id')"
  if [[ -z "$zone_id" || "$zone_id" == "null" ]]; then
    bad "zone ${ZONE} id 조회 실패(토큰 스코프·zone 이름 확인)."
  else
    rec_json="$(cf_api "zones/${zone_id}/dns_records?type=A&name=${HOST}")"
    proxied="$(json_field "$rec_json" '.result[0].proxied')"
    case "$proxied" in
      false) pass "레코드 ${HOST} proxied=false (grey-cloud) → internet-closed." ;;
      true)  bad  "레코드 ${HOST} proxied=TRUE (orange) → ArgoCD 가 인터넷에 열려 있다! grey 로 되돌려라." ;;
      *)     bad  "레코드 ${HOST} 의 proxied 상태를 못 읽었다(A 레코드 존재?): '${proxied}'." ;;
    esac
  fi
fi

# ── 단언 2: tailnet-open (유효 인증서 + 라우팅) ───────────────────────
# -k 없이 → 인증서 무효면 curl 이 비정상 종료 → open=fail.
if code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time "$TIMEOUT" "https://${HOST}/" 2>/dev/null)"; then
  if [[ "$code" =~ ^(2|3)[0-9][0-9]$ ]]; then
    pass "https://${HOST}/ → ${code} + 유효 인증서 → tailnet-open."
  else
    bad "https://${HOST}/ 도달했으나 예상 밖 코드 ${code}(argocd-server·IngressRoute 확인)."
  fi
else
  bad "https://${HOST}/ 에 유효 인증서로 도달 실패 — tailnet 위인지, cert(DNS-01)·라우팅 확인."
fi

# ── 단언 3: 회귀 없음 (public host 는 여전히 quizdeck) ────────────────
if body="$(curl -sS --max-time "$TIMEOUT" "https://${PUBLIC_HOST}/api/health/" 2>/dev/null)" \
   && printf '%s' "$body" | grep -q '"sha"'; then
  pass "https://${PUBLIC_HOST}/api/health/ 여전히 quizdeck 응답 → catch-all 무회귀."
else
  bad "https://${PUBLIC_HOST}/api/health/ 가 quizdeck 를 안 준다 — IngressRoute 우선순위가 catch-all 을 가로챘나?"
fi

echo "=================================================="
if [[ "$fail" -eq 0 ]]; then
  echo "ALL PASS — Tailscale 전용 노출 + 인터넷 격리 확인."
else
  echo "일부 FAIL — 위 메시지 참조." >&2
fi
exit "$fail"
