<?php
/** R2 offload — 업로드 훅 경로 그대로(wp_generate_attachment_metadata 필터) 실행. */
require '/tests/_helpers.php';
echo "[40-media]\n";

$png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==');
$up = wp_upload_bits('offload-test.png', null, $png);
t_assert(empty($up['error']), '로컬 업로드 (' . ($up['error'] ?? '') . ')');
$att = wp_insert_attachment(['post_mime_type' => 'image/png', 'post_title' => 't', 'post_status' => 'inherit'], $up['file']);
require_once ABSPATH . 'wp-admin/includes/image.php';
wp_update_attachment_metadata($att, wp_generate_attachment_metadata($att, $up['file']));

$key = get_post_meta($att, '_qd_r2_key', true);
t_assert($key !== '' && str_ends_with($key, 'offload-test.png'), "R2 PUT + _qd_r2_key 기록 ({$key})");
t_assert(wp_get_attachment_url($att) === 'https://media.test.invalid/' . $key, '공개 미디어 도메인 URL 파생');

$meta = wp_get_attachment_metadata($att);
t_assert(empty($meta['sizes']), '중간 사이즈 미생성 (업로드 1건 = 객체 1개)');

update_option('qd_test_r2_key', $key);
wp_delete_attachment($att, true); // R2 DELETE 는 run.sh 가 mc 로 객체 부재 단언
echo "OK\n";
