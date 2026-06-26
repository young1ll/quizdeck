#!/usr/bin/env bash
# verify-isolation.sh — runnable acceptance checks for the DB VM isolation.
#
# This encodes issue #4's acceptance criteria as pass/fail probes. Run it from
# the two vantage points the criteria name:
#
#   ON THE k3s VM (must SUCCEED):
#     ./verify-isolation.sh --expect open  --target <DB_VM_LAN_IP>
#     # optionally prove auth, not just reachability:
#     PGPASSWORD=... ./verify-isolation.sh --expect open --target <DB_VM_LAN_IP> \
#       --psql-user quizdeck --psql-db quizdeck
#
#   ON THE Synology host (and from any other host — must FAIL/timeout):
#     ./verify-isolation.sh --expect closed --target <DB_VM_LAN_IP>
#
# Exit 0 = observed state matches --expect; exit 1 = mismatch (criterion failed).
set -euo pipefail

EXPECT=""        # open | closed
TARGET=""
PG_PORT="${PG_PORT:-5432}"
TIMEOUT="${TIMEOUT:-4}"
PSQL_USER=""
PSQL_DB=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --expect)    EXPECT="$2"; shift 2 ;;
    --target)    TARGET="$2"; shift 2 ;;
    --port)      PG_PORT="$2"; shift 2 ;;
    --psql-user) PSQL_USER="$2"; shift 2 ;;
    --psql-db)   PSQL_DB="$2"; shift 2 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

if [[ "$EXPECT" != "open" && "$EXPECT" != "closed" ]] || [[ -z "$TARGET" ]]; then
  echo "usage: $0 --expect open|closed --target <DB_VM_LAN_IP> [--port N] [--psql-user U --psql-db D]" >&2
  exit 2
fi

# TCP reachability via bash /dev/tcp (no nc dependency).
if timeout "$TIMEOUT" bash -c "exec 3<>/dev/tcp/${TARGET}/${PG_PORT}" 2>/dev/null; then
  REACHABLE=yes
else
  REACHABLE=no
fi
echo "probe ${TARGET}:${PG_PORT} → reachable=${REACHABLE} (expect ${EXPECT})"

rc=0
case "$EXPECT" in
  open)
    if [[ "$REACHABLE" != yes ]]; then
      echo "FAIL: expected port OPEN from here but it is not reachable." >&2
      rc=1
    elif [[ -n "$PSQL_USER" && -n "$PSQL_DB" ]]; then
      if command -v psql >/dev/null && psql -h "$TARGET" -p "$PG_PORT" -U "$PSQL_USER" -d "$PSQL_DB" -tAc 'SELECT 1' | grep -q 1; then
        echo "PASS: psql SELECT 1 succeeded as ${PSQL_USER}@${TARGET}/${PSQL_DB}."
      else
        echo "FAIL: port open but psql auth/query failed (set PGPASSWORD?)." >&2
        rc=1
      fi
    else
      echo "PASS: port reachable (pass --psql-user/--psql-db + PGPASSWORD to also prove auth)."
    fi
    ;;
  closed)
    if [[ "$REACHABLE" == yes ]]; then
      echo "FAIL: postgres is REACHABLE from here — isolation breached." >&2
      rc=1
    else
      echo "PASS: postgres is not reachable from here (isolated)."
    fi
    ;;
esac
exit "$rc"
