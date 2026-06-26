#!/usr/bin/env bash
# configure-firewall.sh — lock postgres to the k3s VM with ufw (ADR-0003 §3).
#
# Idempotent. Run as root ON THE DB VM:
#   sudo K3S_VM_IP=192.168.68.55 ./configure-firewall.sh
#
# Enforces the platform invariant "postgres는 어디서도 인터넷에 직접 노출되지 않는다":
# default-deny inbound, 5432 reachable ONLY from the k3s VM. The Synology host
# can route to guests (host→VM REACHABLE per platform-roadmap.md), so this
# allow-list is what blocks the host (and everything else) from postgres.
set -euo pipefail

K3S_VM_IP="${K3S_VM_IP:-192.168.68.55}"   # the ONLY allowed postgres client
PG_PORT="${PG_PORT:-5432}"
# Management SSH sources. Tailscale CGNAT (100.64.0.0/10) covers tailnet admin
# like k3s-home; the OVS LAN lets you jump in from the k3s VM. Tighten if unused.
SSH_SOURCES="${SSH_SOURCES:-100.64.0.0/10 192.168.68.0/24}"

if [[ $EUID -ne 0 ]]; then
  echo "ERROR: run as root (sudo)." >&2
  exit 1
fi

# Default deny inbound, allow outbound (idempotent).
ufw default deny incoming
ufw default allow outgoing

# SSH from management sources only (so enabling ufw can't lock you out).
for src in $SSH_SOURCES; do
  ufw allow from "$src" to any port 22 proto tcp comment 'ssh mgmt'
done

# postgres ONLY from the k3s VM. No broad rule exists, so the host + internet
# + the rest of the tailnet are denied by the default-deny policy.
ufw allow from "${K3S_VM_IP}/32" to any port "$PG_PORT" proto tcp comment 'postgres k3s-vm only'

ufw --force enable
echo
ufw status verbose
echo
echo "→ postgres ${PG_PORT} allowed from ${K3S_VM_IP}/32 only; everything else denied."
echo "  Next: ./verify-isolation.sh"
