#!/usr/bin/env bash
# configure-firewall-mariadb.sh — lock MariaDB(3306) to the k3s VM with ufw (ADR-0025).
#
# Idempotent. Run as root ON THE DB VM:
#   sudo K3S_VM_IP=192.168.68.55 ./configure-firewall-mariadb.sh
#
# configure-firewall.sh(postgres)가 이미 default-deny 를 깔았다는 전제에서 3306 allow 만
# 추가한다 — 불변식 "DB 는 어디서도 인터넷에 직접 노출되지 않는다"는 postgres 와 동일.
set -euo pipefail

K3S_VM_IP="${K3S_VM_IP:-192.168.68.55}"
MARIADB_PORT="${MARIADB_PORT:-3306}"

if [[ $EUID -ne 0 ]]; then
  echo "ERROR: run as root (sudo)." >&2
  exit 1
fi

ufw allow from "$K3S_VM_IP" to any port "$MARIADB_PORT" proto tcp \
  comment "mariadb from k3s VM only (quizdeck wp — ADR-0025)"
ufw status numbered | grep -E "$MARIADB_PORT" || true

echo "verify (k3s-home 에서): nc -zv <DB_VM_IP> ${MARIADB_PORT}  → open"
echo "verify (그 외 호스트):   nc -zv <DB_VM_IP> ${MARIADB_PORT}  → timeout/refused"
