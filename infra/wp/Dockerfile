# quizdeck WP (headless CMS tier — ADR-0025). 코어·PHP 버전 고정 + 플러그인은 이미지에 굽는다
# (admin 에서 설치 금지 — DISALLOW_FILE_MODS, k8s/wp/deployment.yaml). 갱신 = 태그 bump + CI.
FROM wordpress:6.9-php8.3-apache

# ── 플러그인 베이킹 지점 (2단계에서 채움) ─────────────────────────────────────
# ACF Pro(라이선스 zip — git 밖, CI secret 로 주입) · 미디어 R2 offload · 검증 플러그인(자체).
# 예: COPY plugins/quizdeck-content /usr/src/wordpress/wp-content/plugins/quizdeck-content
