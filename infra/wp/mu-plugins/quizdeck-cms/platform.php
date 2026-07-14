<?php
/**
 * platform 모듈 — QuizDeck 가 WP 에 요구하는 플랫폼 행동 전부(흡수 결정 2026-07-14).
 * "제품 행동"(환경 불변)만 소유한다 — 환경값(WP_HOME·WP_SITEURL·HTTPS 프록시, 로컬/프로드
 * 상이)은 배포 계층(k8s WORDPRESS_CONFIG_EXTRA)에 남긴다(의도적 비흡수).
 */

defined('ABSPATH') || exit;

// ── 코드는 이미지가 소유(GitOps — ADR-0025 결정 7). 구 k8s CONFIG_EXTRA 에서 이관 —
//    !defined 가드: 매니페스트와 이미지의 롤아웃 순서 어느 쪽이든 이중 정의 없이 안전.
if (!defined('DISALLOW_FILE_MODS')) define('DISALLOW_FILE_MODS', true);
if (!defined('AUTOMATIC_UPDATER_DISABLED')) define('AUTOMATIC_UPDATER_DISABLED', true);

// ── XML-RPC 차단 — 미사용 공격 표면(크리덴셜 브루트포스·핑백 증폭)
add_filter('xmlrpc_enabled', '__return_false');
add_filter('pings_open', '__return_false');
add_filter('wp_headers', function (array $headers): array {
    unset($headers['X-Pingback']);
    return $headers;
});

// ── REST 사용자 열거 차단 — 익명에게만. 콘텐츠 계약(published qd_* 익명 read)은 불변,
//    admin 화면의 로그인 세션 REST 사용은 그대로 동작한다.
add_filter('rest_endpoints', function (array $endpoints): array {
    if (is_user_logged_in()) return $endpoints;
    unset($endpoints['/wp/v2/users'], $endpoints['/wp/v2/users/(?P<id>[\d]+)'], $endpoints['/wp/v2/users/me']);
    return $endpoints;
});

// ── headless 에 무의미한 표면 제거 — 피드·oEmbed 디스커버리·이모지 스크립트·generator(버전 노출)
foreach (['do_feed', 'do_feed_rdf', 'do_feed_rss', 'do_feed_rss2', 'do_feed_atom'] as $feed) {
    add_action($feed, 'qd_platform_no_feed', 1);
}
function qd_platform_no_feed(): void
{
    wp_die('headless — 피드 없음', '', ['response' => 404]);
}
remove_action('wp_head', 'feed_links', 2);
remove_action('wp_head', 'feed_links_extra', 3);
remove_action('wp_head', 'wp_oembed_add_discovery_links');
remove_action('wp_head', 'wp_oembed_add_host_js');
remove_action('wp_head', 'print_emoji_detection_script', 7);
remove_action('admin_print_scripts', 'print_emoji_detection_script');
remove_action('wp_print_styles', 'print_emoji_styles');
remove_action('admin_print_styles', 'print_emoji_styles');
remove_action('wp_head', 'wp_generator');
add_filter('the_generator', '__return_empty_string');

// ── 프론트 → admin — headless 라 프론트 렌더는 무의미(테마 화면 대신 저작 표면으로).
//    template_redirect 는 프론트 메인 쿼리에만 발화 — REST·admin·wp-login 은 안 지난다.
add_action('template_redirect', 'qd_platform_front_redirect');
function qd_platform_front_redirect(): void
{
    wp_safe_redirect(admin_url(), 302);
    exit;
}
