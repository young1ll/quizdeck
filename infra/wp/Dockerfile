# quizdeck WP (headless CMS tier — ADR-0025). 코어·PHP 버전 고정 + 플러그인은 이미지에 굽는다
# (admin 에서 설치 금지 — DISALLOW_FILE_MODS, k8s/wp/deployment.yaml). 갱신 = 태그 bump + CI.
# 언어팩도 같은 원칙 — DISALLOW_FILE_MODS 는 번역 설치도 막으므로 ko_KR 을 이미지에 굽는다.
# 코어 버전 bump 시 WP_VERSION 도 같이 — 언어팩 URL 이 버전에 묶여 있다.
ARG WP_VERSION=6.9

# ko_KR 코어 언어팩(ko_KR.mo·admin·admin-network·continents-cities) — translate.wordpress.org
FROM wordpress:${WP_VERSION}-php8.3-apache AS lang
ARG WP_VERSION
RUN apt-get update && apt-get install -y --no-install-recommends unzip \
 && curl -fsSL -o /tmp/ko_KR.zip "https://downloads.wordpress.org/translation/core/${WP_VERSION}/ko_KR.zip" \
 && mkdir -p /tmp/languages && unzip -q /tmp/ko_KR.zip -d /tmp/languages

# OIDC 클라이언트 플러그인(wp-admin SSO — ADR-0028). wp.org 배포 zip(vendor 동봉)을 버전·해시
# 고정으로 다운로드 — 활성화는 mu-plugin sso.php 가 require 로 수행(DB active_plugins 무관).
FROM wordpress:${WP_VERSION}-php8.3-apache AS oidc
ARG OIDC_PLUGIN_VERSION=3.11.3
ARG OIDC_PLUGIN_SHA256=81c009fe8f8f1504b329656d5a41176b5de09febfca4574393889c46387f8a97
RUN apt-get update && apt-get install -y --no-install-recommends unzip \
 && curl -fsSL -o /tmp/oidc.zip "https://downloads.wordpress.org/plugin/daggerhart-openid-connect-generic.${OIDC_PLUGIN_VERSION}.zip" \
 && echo "${OIDC_PLUGIN_SHA256}  /tmp/oidc.zip" | sha256sum -c - \
 && mkdir -p /tmp/plugins && unzip -q /tmp/oidc.zip -d /tmp/plugins

FROM wordpress:${WP_VERSION}-php8.3-apache
COPY --from=lang /tmp/languages/ /usr/src/wordpress/wp-content/languages/
COPY --from=oidc /tmp/plugins/daggerhart-openid-connect-generic/ /usr/src/wordpress/wp-content/plugins/daggerhart-openid-connect-generic/

# 코어 동봉 기본 플러그인(akismet·hello dolly) 제거 — 미사용인데 DISALLOW_FILE_MODS 라
# admin 에서 삭제 불가 + akismet 은 업데이트 알림만 낸다. 이미지가 소유하니 이미지에서 뺀다.
RUN rm -rf /usr/src/wordpress/wp-content/plugins/akismet /usr/src/wordpress/wp-content/plugins/hello.php

# QuizDeck CMS (mu-plugin — 활성화 불필요·비활성화 불가): content(CPT·검증 게이트·REST·웹훅)
# + media(R2 offload) + locale(ko_KR) 모듈. ACF 대체 자체구현(ADR-0025).
COPY mu-plugins/ /usr/src/wordpress/wp-content/mu-plugins/
