<?php
/** admin 대시보드 — 집계·점검 헬퍼와 렌더 스모크(경계: env 는 상태만, 액션은 왕복 검증). */
require '/tests/_helpers.php';
echo "[50-admin]\n";

$stats = qd_dashboard_stats();
t_assert($stats['counts']['qd_exam']['publish'] === 1 && $stats['counts']['qd_question']['publish'] === 3
    && $stats['counts']['qd_concept']['publish'] === 2 && $stats['counts']['qd_service']['publish'] === 1,
    '카운트 집계 (시험1·문항3·카드2·서비스1)');
t_assert($stats['counts']['qd_question']['draft'] === 0, '초안 0 (게이트 강등 잔재 없음)');
t_assert(count($stats['unlinked']) === 1 && $stats['unlinked'][0]['svc'] === 'ALB vs NLB',
    '편집 큐: 서비스 미참조 카드 = ALB vs NLB');
t_assert($stats['unmapped']['aws/test-01'] === [], 'q2svc 미연결 문항 0 (1·2·3 전부 매핑)');

[$ok, $detail] = qd_dashboard_r2_test();
t_assert($ok === true, "R2 연결 테스트 왕복 ({$detail})");

[$ok, $detail] = qd_dashboard_revalidate_all();
t_assert($ok === false && str_contains($detail, '미설정'), '웹훅 env 부재 → 미설정 보고 (발사 안 함)');

ob_start();
qd_render_dashboard();
$html = ob_get_clean();
t_assert(str_contains($html, 'QuizDeck CMS') && str_contains($html, qd_plugin_version()), '대시보드 렌더 (이름·버전)');
t_assert(str_contains($html, 'ALB vs NLB'), '대시보드에 편집 큐 노출');

// admin → 앱 연결 — CPT 별 프론트 URL 매핑 + 어드민바 노드 + 게시 박스 링크 (2026-07-16)
$examId = (int) get_option('qd_test_exam_id');
t_assert(qd_frontend_url(get_post($examId)) === qd_app_url() . '/aws/test-01/', '프론트 URL: 문제집 → 시험 허브');
$svcPost = get_post((int) get_option('qd_test_service_id'));
t_assert(qd_frontend_url($svcPost) === qd_app_url() . '/aws/map/', '프론트 URL: 서비스 → provider 서비스맵');
$cardPost = get_posts(['post_type' => 'qd_concept', 'title' => 'Amazon EFS', 'post_status' => 'publish', 'numberposts' => 1])[0];
t_assert(str_starts_with((string) qd_frontend_url($cardPost), qd_app_url() . '/aws/test-01/concepts?seed='), '프론트 URL: 카드 → 개념 화면 시드');

require_once ABSPATH . WPINC . '/class-wp-admin-bar.php';
$bar = new WP_Admin_Bar();
qd_admin_bar_app_link($bar);
$node = $bar->get_node('qd-app');
t_assert($node !== null && $node->href === qd_app_url(), '어드민바 학습 앱 노드 (편집 맥락 밖 = 앱 홈)');

ob_start();
do_action('post_submitbox_misc_actions', get_post($examId));
$html = ob_get_clean();
t_assert(str_contains($html, 'qd-view-app') && str_contains($html, '/aws/test-01/'), '게시 박스 앱에서 보기 링크');
echo "OK\n";
