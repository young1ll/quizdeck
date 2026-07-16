<?php
/** platform 모듈 — 코드 소유 defines·XML-RPC 차단·headless 하드닝, 콘텐츠 계약 무손상. */
require '/tests/_helpers.php';
echo "[60-platform]\n";

t_assert(defined('DISALLOW_FILE_MODS') && DISALLOW_FILE_MODS === true, 'DISALLOW_FILE_MODS — 플러그인이 정의');
t_assert(defined('AUTOMATIC_UPDATER_DISABLED') && AUTOMATIC_UPDATER_DISABLED === true, 'AUTOMATIC_UPDATER_DISABLED — 플러그인이 정의');

t_assert(current_theme_supports('post-thumbnails'), '대표이미지 지원 — 테마 무관 플러그인 선언');
// $common + [...] 병합 함정 회귀 가드 — supports 가 공통에 끼면 타입별 thumbnail 선언이 조용히 죽는다.
$thumbOk = true;
foreach (['qd_exam', 'qd_question', 'qd_concept', 'qd_diagram', 'qd_service'] as $t) {
    $thumbOk = $thumbOk && post_type_supports($t, 'thumbnail');
}
t_assert($thumbOk, '전 CPT thumbnail supports 등록(대표이미지 박스 게이트)');

t_assert(apply_filters('xmlrpc_enabled', true) === false, 'XML-RPC 비활성');
t_assert(apply_filters('pings_open', true, 0) === false, '핑백 차단');

// 익명(CLI uid 0) 시야 — users 열거 차단, 콘텐츠 계약은 불변
$users = t_rest('/wp/v2/users');
t_assert(($users['code'] ?? '') === 'rest_no_route', '익명 /wp/v2/users → rest_no_route');
$exams = t_rest('/wp/v2/qd-exams');
t_assert(is_array($exams) && isset($exams[0]['qd']['exam_key']), '콘텐츠 익명 read 계약 불변 (qd-exams 정상)');

t_assert(apply_filters('the_generator', 'x') === '', 'generator 버전 노출 제거');
t_assert(has_action('wp_head', 'wp_generator') === false, 'wp_head generator 제거');
t_assert(has_action('wp_head', 'print_emoji_detection_script') === false, '이모지 스크립트 제거');
t_assert(has_action('wp_head', 'feed_links') === false, '피드 링크 제거');
t_assert(has_action('do_feed_rss2', 'qd_platform_no_feed') === 1, '피드 요청 404 핸들러 등록');
t_assert(has_action('template_redirect', 'qd_platform_front_redirect') === 10, '프론트 → admin 리다이렉트 등록');
echo "OK\n";
