<?php
/** media 일반화 (a) — env 소스 우선·정책 필터·메뉴트리 배치. (options 폴백은 71 — 별도 프로세스) */
require '/tests/_helpers.php';
echo "[70-media-portable]\n";

t_assert(qd_media_config_source() === 'env', '설정 소스 = env (compose 주입)');

// 중간 사이즈 정책 필터 — 기본 억제, 필터 false 로 WP 기본 복원
t_assert(apply_filters('intermediate_image_sizes_advanced', ['thumbnail' => ['w' => 1]]) === [],
    '중간 사이즈 기본 억제');
add_filter('qd_media_disable_sizes', '__return_false');
t_assert(apply_filters('intermediate_image_sizes_advanced', ['thumbnail' => ['w' => 1]]) === ['thumbnail' => ['w' => 1]],
    'qd_media_disable_sizes=false → WP 기본 복원');
remove_filter('qd_media_disable_sizes', '__return_false');

// 메뉴트리 — CPT 4종이 QuizDeck 메뉴 아래로
foreach (['qd_exam', 'qd_question', 'qd_concept', 'qd_service'] as $type) {
    t_assert(get_post_type_object($type)->show_in_menu === 'quizdeck-cms', "{$type} → QuizDeck 서브메뉴");
}

// 설정 페이지 렌더 — env 우선 상태 고지
ob_start();
qd_media_render_settings();
$html = ob_get_clean();
t_assert(str_contains($html, '환경변수(QD_MEDIA_*)가 우선 적용 중'), '설정 페이지: env 우선 상태 표시');
echo "OK\n";
