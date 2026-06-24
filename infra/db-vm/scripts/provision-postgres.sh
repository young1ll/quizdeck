#!/usr/bin/env bash
# provision-postgres.sh — configure postgres on db-home for the quizdeck data tier.
#
# Idempotent. Run as root ON THE DB VM after first boot:
#   sudo K3S_VM_IP=192.168.68.55 ./provision-postgres.sh
#
# What it does (ADR-0003 §3):
#   - binds postgres to localhost + the DB VM's LAN IP only (defense in depth
#     alongside the firewall — see configure-firewall.sh)
#   - forces scram-sha-256 password auth
#   - creates the app role + database (better-auth tables + progress live here;
#     this script does NOT create schema — that is V1/V2 migrations)
#   - allows the k3s VM (and only it) in pg_hba.conf
#   - prints the connection info / kubectl Secret command (NEVER committed)
set -euo pipefail

# ── parameters (override via env) ───────────────────────────────────────────
APP_DB="${APP_DB:-quizdeck}"
APP_ROLE="${APP_ROLE:-quizdeck}"
APP_PASSWORD="${APP_PASSWORD:-}"          # empty → generated on role creation
K3S_VM_IP="${K3S_VM_IP:-192.168.68.55}"   # the ONLY allowed postgres client
PG_PORT="${PG_PORT:-5432}"
# This VM's LAN IP for listen_addresses. Derive it from the route TO the k3s VM
# so it picks the OVS LAN interface even when Tailscale (100.x) is also up
# (hostname -I's first entry can be the tailnet IP). Override if needed.
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

# ── locate the postgres cluster config dir ──────────────────────────────────
PG_VER="$(find /etc/postgresql -mindepth 1 -maxdepth 1 -type d -printf '%f\n' 2>/dev/null | sort -V | tail -1 || true)"
if [[ -z "$PG_VER" ]]; then
  echo "ERROR: no postgres cluster under /etc/postgresql. Is postgresql installed?" >&2
  exit 1
fi
PG_CONF_DIR="/etc/postgresql/${PG_VER}/main"
PG_HBA="${PG_CONF_DIR}/pg_hba.conf"
echo "→ postgres ${PG_VER} cluster at ${PG_CONF_DIR}"
echo "→ DB VM LAN IP: ${DB_VM_LAN_IP} · allowed client (k3s VM): ${K3S_VM_IP}"

# ── listen_addresses + scram via a drop-in (idempotent overwrite) ────────────
# Ubuntu's postgresql.conf ships `include_dir = 'conf.d'`; ensure it's present.
if ! grep -Eq "^[[:space:]]*include_dir[[:space:]]*=[[:space:]]*'conf.d'" "${PG_CONF_DIR}/postgresql.conf"; then
  echo "include_dir = 'conf.d'" >> "${PG_CONF_DIR}/postgresql.conf"
fi
install -d -m 755 "${PG_CONF_DIR}/conf.d"
cat > "${PG_CONF_DIR}/conf.d/10-quizdeck.conf" <<EOF
# Managed by infra/db-vm/scripts/provision-postgres.sh — do not edit by hand.
listen_addresses = 'localhost,${DB_VM_LAN_IP}'
port = ${PG_PORT}
password_encryption = scram-sha-256
EOF

# ── pg_hba: allow ONLY the k3s VM to the app role/db (managed block) ─────────
HBA_BEGIN="# >>> quizdeck db-vm managed >>>"
HBA_END="# <<< quizdeck db-vm managed <<<"
# strip any prior managed block, then append a fresh one
tmp="$(mktemp)"
sed "/${HBA_BEGIN}/,/${HBA_END}/d" "$PG_HBA" > "$tmp"
{
  cat "$tmp"
  echo "$HBA_BEGIN"
  echo "# quizdeck app role reachable only from the k3s VM (OVS guest↔guest)."
  printf 'host    %-12s %-12s %-18s scram-sha-256\n' "$APP_DB" "$APP_ROLE" "${K3S_VM_IP}/32"
  echo "$HBA_END"
} > "$PG_HBA"
rm -f "$tmp"
chown postgres:postgres "$PG_HBA"
chmod 640 "$PG_HBA"

# ── restart so listen_addresses takes effect (also reloads pg_hba) ───────────
systemctl restart postgresql
systemctl is-active --quiet postgresql

# ── app role + database (idempotent) ─────────────────────────────────────────
role_exists() { sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${APP_ROLE}'" | grep -q 1; }
db_exists()   { sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${APP_DB}'" | grep -q 1; }

PRINT_PASSWORD=""
if role_exists; then
  echo "→ role '${APP_ROLE}' exists"
  if [[ -n "$APP_PASSWORD" ]]; then
    sudo -u postgres psql -v pw="$APP_PASSWORD" -qc "ALTER ROLE \"${APP_ROLE}\" WITH LOGIN PASSWORD :'pw';"
    echo "  rotated password (APP_PASSWORD was provided)"
    PRINT_PASSWORD="$APP_PASSWORD"
  else
    echo "  password left unchanged (set APP_PASSWORD to rotate)"
  fi
else
  if [[ -z "$APP_PASSWORD" ]]; then
    APP_PASSWORD="$(tr -dc 'A-Za-z0-9' </dev/urandom | head -c 32)"
  fi
  sudo -u postgres psql -v pw="$APP_PASSWORD" -qc "CREATE ROLE \"${APP_ROLE}\" WITH LOGIN PASSWORD :'pw';"
  echo "→ created role '${APP_ROLE}'"
  PRINT_PASSWORD="$APP_PASSWORD"
fi

if db_exists; then
  echo "→ database '${APP_DB}' exists"
else
  sudo -u postgres psql -qc "CREATE DATABASE \"${APP_DB}\" OWNER \"${APP_ROLE}\";"
  echo "→ created database '${APP_DB}' (owner ${APP_ROLE})"
fi

# ── output (credentials go to a k8s Secret, NOT git — see ../k8s/README.md) ──
echo
echo "════════════════════════════════════════════════════════════════════════"
echo " postgres ready: ${APP_ROLE}@${DB_VM_LAN_IP}:${PG_PORT}/${APP_DB}"
echo " Next: ./configure-firewall.sh  then  ./verify-isolation.sh"
if [[ -n "$PRINT_PASSWORD" ]]; then
  echo
  echo " Create the k8s Secret (run on a kubectl host — DO NOT COMMIT):"
  echo "   kubectl -n quizdeck create secret generic db-credentials \\"
  echo "     --from-literal=DATABASE_URL='postgres://${APP_ROLE}:${PRINT_PASSWORD}@${DB_VM_LAN_IP}:${PG_PORT}/${APP_DB}'"
else
  echo " (password unchanged; reuse the existing db-credentials Secret.)"
fi
echo "════════════════════════════════════════════════════════════════════════"
