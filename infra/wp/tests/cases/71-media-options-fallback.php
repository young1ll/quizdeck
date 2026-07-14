<?php
/**
 * options 폴백 — env 를 프로세스에서 제거(putenv)한 뒤 admin 설정만으로 업로드 왕복.
 * qd_media_config 는 프로세스 static 캐시라 이 케이스는 첫 config 호출 전에 소스를 확정한다.
 */
require '/tests/_helpers.php';
echo "[71-media-options-fallback]\n";

foreach (qd_media_fields() as $env) putenv($env); // env 제거 → options 소스로
update_option('qd_media_endpoint', 'http://minio:9000');
update_option('qd_media_bucket', 'qd-media');
update_option('qd_media_key', 'testkey');
update_option('qd_media_secret', 'testsecret123');
update_option('qd_media_base_url', 'https://media-opt.test.invalid');

t_assert(qd_media_config_source() === 'options', '설정 소스 = options (env 부재 폴백)');

// 키 정책 필터를 단 채로 실업로드 — options 자격증명 + 필터 경로 동시 검증
add_filter('qd_media_object_key', fn(string $key): string => "custom/{$key}", 10, 1);
$png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==');
$up = wp_upload_bits('opt-fallback.png', null, $png);
$att = wp_insert_attachment(['post_mime_type' => 'image/png', 'post_title' => 'opt', 'post_status' => 'inherit'], $up['file']);
require_once ABSPATH . 'wp-admin/includes/image.php';
wp_update_attachment_metadata($att, wp_generate_attachment_metadata($att, $up['file']));

$key = (string) get_post_meta($att, '_qd_r2_key', true);
t_assert(str_starts_with($key, 'custom/') && str_ends_with($key, 'opt-fallback.png'),
    "options 자격증명으로 R2 PUT + 키 필터 적용 ({$key})");
t_assert(wp_get_attachment_url($att) === 'https://media-opt.test.invalid/' . $key, 'options base_url 로 URL 파생');

wp_delete_attachment($att, true); // 객체 삭제 — run.sh 의 버킷 빈 상태 단언에 합류
foreach (array_keys(qd_media_fields()) as $f) delete_option("qd_media_{$f}"); // 후속 오염 방지
echo "OK\n";
