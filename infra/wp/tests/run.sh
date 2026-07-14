#!/usr/bin/env sh
# mu-plugin 통합 테스트 — CI(wp-image)·로컬 공용. 실패 시 비 0 종료(빌드 차단).
set -eu
cd "$(dirname "$0")"

cleanup() { docker compose down -v >/dev/null 2>&1 || true; }
trap cleanup EXIT

docker compose up -d --quiet-pull 2>/dev/null || docker compose up -d

# WP 준비 대기(핵심 파일 복사 완료 기준) + 설치
docker compose exec -T -u root cli sh -c '
  for i in $(seq 1 60); do [ -f /var/www/html/wp-load.php ] && break; sleep 2; done
  mkdir -p /var/www/html/wp-content/uploads && chown www-data /var/www/html/wp-content/uploads'
docker compose exec -T -u www-data cli sh -c '
  for i in $(seq 1 30); do wp db check >/dev/null 2>&1 && break; sleep 2; done
  wp core install --url=http://localhost:8898 --title=t --admin_user=admin \
    --admin_password=test-only-pw --admin_email=t@test.invalid --skip-email >/dev/null'

# R2(MinIO) 버킷
docker compose exec -T minio sh -c \
  'mc alias set local http://localhost:9000 testkey testsecret123 >/dev/null && mc mb -p local/qd-media >/dev/null'

# 케이스 실행 (번호 순 — 00 픽스처를 이후 케이스가 공유)
for case in cases/[0-9]*.php; do
  docker compose exec -T -u www-data cli wp eval-file "/tests/$(basename "$case")"
done

# R2 객체 수준 단언 — 40-media 의 업로드 객체가 삭제로 비워졌는가
LEFT=$(docker compose exec -T minio mc ls -r local/qd-media | wc -l | tr -d ' ')
[ "$LEFT" = "0" ] || { echo "  FAIL R2 객체 잔존 ${LEFT}건 (delete_attachment 미동작)"; exit 1; }
echo "  PASS 첨부 삭제 → R2 객체 삭제"

echo "ALL TESTS PASSED"
