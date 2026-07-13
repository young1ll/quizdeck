#!/usr/bin/env bash
# provision-mariadb.sh — configure MariaDB on db-home for the headless WordPress tier.
#
# Idempotent. Run as root ON THE DB VM (postgres 와 같은 박스 — ADR-0025):
#   sudo K3S_VM_IP=192.168.68.55 ./provision-mariadb.sh
#
# What it does (provision-postgres.sh 의 MariaDB 등가):
#   - installs mariadb-server (Ubuntu 24.04 → MariaDB 10.11)
#   - binds to localhost + the DB VM's LAN IP only (defense in depth with ufw)
#   - creates the WP database + user, host-restricted to the k3s VM
#   - prints the kubectl Secret command (NEVER committed)
# Firewall(3306 allow from k3s only)은 configure-firewall-mariadb.sh 가 담당.
set -euo pipefail

WP_DB="${WP_DB:-wordpress}"
WP_USER="${WP_USER:-wordpress}"
WP_PASSWORD="${WP_PASSWORD:-}"            # empty → generated
K3S_VM_IP="${K3S_VM_IP:-192.168.68.55}"   # the ONLY allowed mariadb client
MARIADB_PORT="${MARIADB_PORT:-3306}"
DB_VM_LAN_IP="${DB_VM_LAN_IP:-$(ip -4 route get "$K3S_VM_IP" 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src"){print $(i+1); exit}}')}"
DB_VM_LAN_IP="${DB_VM_LAN_IP:-$(hostname -I | awk '{print $1}')}"

if [[ $EUID -ne 0 ]]; then
  echo "ERROR: run as root (sudo)." >&2
  exit 1
fi
if [[ -z "$DB_VM_LAN_IP" ]]; then
  echo "ERROR: could not detect DB_VM_LAN_IP; set it explicitly." >&2
  exit 1
fi

echo "→ DB VM LAN IP: ${DB_VM_LAN_IP} · allowed client (k3s VM): ${K3S_VM_IP}"

# ── install (idempotent) ─────────────────────────────────────────────────────
if ! command -v mariadbd >/dev/null 2>&1; then
  echo "→ installing mariadb-server"
  DEBIAN_FRONTEND=noninteractive apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq mariadb-server
fi

# ── bind to localhost + LAN IP only (drop-in, idempotent overwrite) ─────────
# MariaDB 10.11 supports a comma-separated bind-address list.
cat > /etc/mysql/mariadb.conf.d/60-quizdeck-wp.cnf <<EOF
# managed by infra/wp-db/provision-mariadb.sh — do not edit by hand
[mysqld]
bind-address = 127.0.0.1,${DB_VM_LAN_IP}
port = ${MARIADB_PORT}
EOF
systemctl enable --now mariadb
systemctl restart mariadb

# ── database + user (host-restricted to the k3s VM) ─────────────────────────
if [[ -z "$WP_PASSWORD" ]]; then
  WP_PASSWORD="$(tr -dc 'A-Za-z0-9' </dev/urandom | head -c 32)"
  GENERATED=1
else
  GENERATED=0
fi

mariadb --protocol=socket <<SQL
CREATE DATABASE IF NOT EXISTS \`${WP_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${WP_USER}'@'${K3S_VM_IP}' IDENTIFIED BY '${WP_PASSWORD}';
ALTER USER '${WP_USER}'@'${K3S_VM_IP}' IDENTIFIED BY '${WP_PASSWORD}';
GRANT ALL PRIVILEGES ON \`${WP_DB}\`.* TO '${WP_USER}'@'${K3S_VM_IP}';
FLUSH PRIVILEGES;
SQL

echo
echo "── done ─────────────────────────────────────────────────────────────────"
echo "database: ${WP_DB} · user: ${WP_USER}@${K3S_VM_IP}"
[[ "$GENERATED" == 1 ]] && echo "generated password (SAVE NOW — not stored anywhere):"
echo
echo "kubectl 호스트(k3s-home)에서 Secret 생성 (git 밖 — k8s/wp/README.md):"
echo "  kubectl -n wordpress create secret generic wp-db-credentials \\"
echo "    --from-literal=WORDPRESS_DB_HOST='${DB_VM_LAN_IP}:${MARIADB_PORT}' \\"
echo "    --from-literal=WORDPRESS_DB_NAME='${WP_DB}' \\"
echo "    --from-literal=WORDPRESS_DB_USER='${WP_USER}' \\"
echo "    --from-literal=WORDPRESS_DB_PASSWORD='${WP_PASSWORD}'"
echo
echo "다음: sudo K3S_VM_IP=${K3S_VM_IP} ./configure-firewall-mariadb.sh"
