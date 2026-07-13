# quizdeck WP (headless CMS tier — ADR-0025). 코어·PHP 버전 고정 + 플러그인은 이미지에 굽는다
# (admin 에서 설치 금지 — DISALLOW_FILE_MODS, k8s/wp/deployment.yaml). 갱신 = 태그 bump + CI.
FROM wordpress:6.9-php8.3-apache

# quizdeck-content (mu-plugin — 활성화 불필요·비활성화 불가): CPT·메타박스·검증·REST.
# ACF 대체 자체구현(ADR-0025 애던덤 예정 — 사용자 결정 2026-07-13).
COPY mu-plugins/ /usr/src/wordpress/wp-content/mu-plugins/
