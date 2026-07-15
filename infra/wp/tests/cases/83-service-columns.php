<?php
/** 서비스 목록 컬럼 — 아이콘(유효 아이콘 규율)·provider·분류 표시 + 정렬 등록. */
require '/tests/_helpers.php';
echo "[83-service-columns]\n";
$svc = (int) get_option('qd_test_service_id');

$cols = apply_filters('manage_qd_service_posts_columns', ['cb' => '<input>', 'title' => '제목', 'date' => '날짜']);
t_assert(isset($cols['qd_svc_icon'], $cols['qd_provider'], $cols['qd_cat']), '컬럼 3종 등록 (아이콘·provider·분류)');
t_assert(array_keys($cols)[2] === 'qd_svc_icon', '컬럼 위치 — 제목 다음');

$cell = function (string $col) use ($svc): string {
    ob_start();
    do_action('manage_qd_service_posts_custom_column', $col, $svc);
    return ob_get_clean();
};
t_assert(str_contains($cell('qd_provider'), 'aws'), 'provider 셀');
t_assert(str_contains($cell('qd_cat'), '스토리지'), '분류 셀');
t_assert(str_contains($cell('qd_svc_icon'), '<span') || str_contains($cell('qd_svc_icon'), '<img'), '아이콘 셀(이모지 span — 픽스처 🗂️/🧪)');

// 대표이미지가 있으면 img 우선(유효 아이콘 규율)
$png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==');
$up = wp_upload_bits('col-icon.png', null, $png);
$att = wp_insert_attachment(['post_mime_type' => 'image/png', 'post_title' => 'c', 'post_status' => 'inherit'], $up['file']);
require_once ABSPATH . 'wp-admin/includes/image.php';
wp_update_attachment_metadata($att, wp_generate_attachment_metadata($att, $up['file']));
set_post_thumbnail($svc, $att);
t_assert(str_contains($cell('qd_svc_icon'), '<img') && str_contains($cell('qd_svc_icon'), 'media.test.invalid'), '대표이미지 → img 셀');
delete_post_thumbnail($svc);
wp_delete_attachment($att, true);

$sortable = apply_filters('manage_edit-qd_service_sortable_columns', []);
t_assert(isset($sortable['qd_provider'], $sortable['qd_cat']), 'provider·분류 정렬 등록');
echo "OK\n";
