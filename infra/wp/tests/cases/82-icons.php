<?php
/** 아이콘 편집 확장 — 문제집 이미지 아이콘(대표이미지 우선) + 카드 아이콘 오버라이드. */
require '/tests/_helpers.php';
echo "[82-icons]\n";
$exam = (int) get_option('qd_test_exam_id');

// 공용 첨부
$png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==');
$up = wp_upload_bits('icon-ext.png', null, $png);
$att = wp_insert_attachment(['post_mime_type' => 'image/png', 'post_title' => 'ic', 'post_status' => 'inherit'], $up['file']);
require_once ABSPATH . 'wp-admin/includes/image.php';
wp_update_attachment_metadata($att, wp_generate_attachment_metadata($att, $up['file']));
$mediaUrl = wp_get_attachment_url($att);

// 문제집: 대표이미지 = 이미지 아이콘(이모지 오버라이드)
update_post_meta($exam, 'qd_icon', wp_slash('🏗️'));
set_post_thumbnail($exam, $att);
$exams = t_rest('/wp/v2/qd-exams');
foreach ($exams as $e) if ($e['qd']['exam_key'] === 'aws/test-01') {
    t_assert($e['qd']['icon'] === $mediaUrl, '문제집 유효 아이콘 = 대표이미지 URL 우선');
}
delete_post_thumbnail($exam);
$exams = t_rest('/wp/v2/qd-exams');
foreach ($exams as $e) if ($e['qd']['exam_key'] === 'aws/test-01') {
    t_assert($e['qd']['icon'] === '🏗️', '대표이미지 제거 → 이모지 폴백');
}
delete_post_meta($exam, 'qd_icon');

// 카드 아이콘 오버라이드: 카드 qd_icon > 참조 서비스 아이콘 / 미참조 카드도 아이콘 가능
$efs = get_posts(['post_type' => 'qd_concept', 'title' => 'Amazon EFS', 'post_status' => 'publish', 'numberposts' => 1])[0]->ID;
$alb = get_posts(['post_type' => 'qd_concept', 'title' => 'ALB vs NLB', 'post_status' => 'publish', 'numberposts' => 1])[0]->ID;
update_post_meta($efs, 'qd_icon', wp_slash('🗄️'));  // 서비스 참조 있어도 카드가 이김
update_post_meta($alb, 'qd_icon', wp_slash('⚖️2')); // 미참조(묶음) 카드의 자체 아이콘
wp_update_post(['ID' => $efs, 'post_status' => 'publish']); // 캐시 무효화
$exams = t_rest('/wp/v2/qd-exams');
foreach ($exams as $e) if ($e['qd']['exam_key'] === 'aws/test-01') {
    t_assert($e['qd']['svc_icons']['Amazon EFS'] === '🗄️', '카드 오버라이드 > 서비스 아이콘');
    t_assert($e['qd']['svc_icons']['ALB vs NLB'] === '⚖️2', '미참조 카드도 자체 아이콘');
}
// 원상 복구(오버라이드 제거 → 서비스 파생 복귀)
delete_post_meta($efs, 'qd_icon');
delete_post_meta($alb, 'qd_icon');
wp_update_post(['ID' => $efs, 'post_status' => 'publish']);
$exams = t_rest('/wp/v2/qd-exams');
foreach ($exams as $e) if ($e['qd']['exam_key'] === 'aws/test-01') {
    t_assert(($e['qd']['svc_icons']['Amazon EFS'] ?? '') === '🧪', '오버라이드 제거 → 서비스 파생 복귀');
}
wp_delete_attachment($att, true);
echo "OK\n";
