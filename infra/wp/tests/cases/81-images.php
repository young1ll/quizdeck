<?php
/** 이미지 확장 — 서비스 아이콘 이미지 우선·개념 카드 이미지·다이어그램 svg-또는-이미지·slug 예약어. */
require '/tests/_helpers.php';
echo "[81-images]\n";
$exam = (int) get_option('qd_test_exam_id');
$svc  = (int) get_option('qd_test_service_id');

// 공용 첨부(R2 offload 경유) — 케이스 끝에서 삭제(run.sh 버킷 빈 상태 단언에 합류)
$png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==');
$up = wp_upload_bits('img-ext.png', null, $png);
$att = wp_insert_attachment(['post_mime_type' => 'image/png', 'post_title' => 'i', 'post_status' => 'inherit'], $up['file']);
require_once ABSPATH . 'wp-admin/includes/image.php';
wp_update_attachment_metadata($att, wp_generate_attachment_metadata($att, $up['file']));
$mediaUrl = wp_get_attachment_url($att);
t_assert(str_starts_with($mediaUrl, 'https://media.test.invalid/'), "첨부 R2 URL ({$mediaUrl})");

// 서비스 아이콘: 대표이미지가 데이터 URI 를 오버라이드 — icons 파생 + 서비스 투영 둘 다
set_post_thumbnail($svc, $att);
wp_update_post(['ID' => $svc, 'post_status' => 'publish']); // 캐시 무효화
$exams = t_rest('/wp/v2/qd-exams');
foreach ($exams as $e) if ($e['qd']['exam_key'] === 'aws/test-01') {
    t_assert($e['qd']['svc_icons']['Amazon EFS'] === $mediaUrl, '서비스 아이콘 = 대표이미지 URL 우선(icons 파생)');
}
$services = t_rest('/wp/v2/qd-services', ['qd_provider' => 'aws']);
t_assert($services[0]['qd']['icon'] === $mediaUrl, '서비스 투영 icon = 유효 아이콘(이미지 오버라이드)');
delete_post_thumbnail($svc);

// 개념 카드 이미지
$card = get_posts(['post_type' => 'qd_concept', 'title' => 'Amazon EFS', 'post_status' => 'publish', 'numberposts' => 1])[0]->ID;
set_post_thumbnail($card, $att);
$concepts = t_rest('/wp/v2/qd-concepts', ['qd_exam' => $exam, 'qd_orderby' => 'num']);
foreach ($concepts as $c) if ($c['qd']['svc'] === 'Amazon EFS') {
    t_assert($c['qd']['image'] === $mediaUrl, '개념 카드 투영 image');
}
delete_post_thumbnail($card);

// 다이어그램: svg 없이 이미지만 → 게시 통과, 둘 다 없으면 → 강등
$id = t_post('qd_diagram', 'img-only', ['qd_exam_id' => (string) $exam, 'qd_diag_id' => 'img-only', 'qd_ord' => '5'], 'draft');
set_post_thumbnail($id, $att);
wp_update_post(['ID' => $id, 'post_status' => 'publish']);
t_assert(get_post_status($id) === 'publish', '이미지 전용 다이어그램 게시 통과');
delete_transient("qd_diagrams_{$exam}");
$exams = t_rest('/wp/v2/qd-exams');
foreach ($exams as $e) if ($e['qd']['exam_key'] === 'aws/test-01') {
    $found = array_values(array_filter($e['qd']['diagrams'], fn($d) => $d['id'] === 'img-only'));
    t_assert(($found[0]['image'] ?? '') === $mediaUrl && ($found[0]['svg'] ?? '') === '', '다이어그램 파생에 image 포함(svg 빈값)');
}
wp_delete_post($id, true);
$id = t_post('qd_diagram', 'empty-diag', ['qd_exam_id' => (string) $exam, 'qd_diag_id' => 'empty-diag', 'qd_ord' => '6']);
t_assert(get_post_status($id) === 'draft', 'SVG·이미지 둘 다 없음 → draft 강등');
wp_delete_post($id, true);

// wp_id 투영 + 행 액션 '앱에서 보기' (프론트-admin 연결성)
$concepts = t_rest('/wp/v2/qd-concepts', ['qd_exam' => $exam, 'qd_orderby' => 'num']);
t_assert(($concepts[0]['qd']['wp_id'] ?? 0) > 0, '투영에 wp_id (편집 딥링크용)');
$cardPost = get_post($card);
$actions = apply_filters('post_row_actions', [], $cardPost);
t_assert(str_contains($actions['qd_view_app'] ?? '', '/aws/test-01/concepts?seed='), "행 액션 '앱에서 보기' (개념 카드 → seed 딥링크)");
$svcPost = get_posts(['post_type' => 'qd_service', 'post_status' => 'publish', 'numberposts' => 1])[0];
$actions = apply_filters('post_row_actions', [], $svcPost);
t_assert(str_contains($actions['qd_view_app'] ?? '', '/aws/map/'), "행 액션 (서비스 → provider 맵)");

// exam slug 예약어
$id = t_post('qd_exam', 'BAD', ['qd_provider' => 'aws', 'qd_slug' => 'map', 'qd_provider_name' => 'AWS', 'qd_code' => 'BAD']);
t_assert(get_post_status($id) === 'draft', "slug 'map' 예약어 → draft 강등");
wp_delete_post($id, true);

// 문항 이미지 2종(2026-07-16) — image = 지문(qd_image, 비면 썸네일 폴백), thumb = 썸네일(대표이미지)
$q1 = get_posts(['post_type' => 'qd_question', 'post_status' => 'publish', 'numberposts' => 1,
    'meta_query' => [['key' => 'qd_qn', 'value' => '1']]])[0]->ID;
set_post_thumbnail($q1, $att);
$qRest = fn(): array => t_rest('/wp/v2/qd-questions', ['qd_exam' => $exam, 'qd_qn_in' => '1'])[0]['qd'];
$qd = $qRest();
t_assert($qd['image'] === $mediaUrl && $qd['thumb'] === $mediaUrl, '문항: 썸네일만 → image 폴백(구 계약 보존) + thumb');
update_post_meta($q1, 'qd_image', 'https://media.test.invalid/body.png');
$qd = $qRest();
t_assert($qd['image'] === 'https://media.test.invalid/body.png' && $qd['thumb'] === $mediaUrl,
    '문항: 지문 이미지 지정 → image=qd_image · thumb=썸네일 분리');
delete_post_meta($q1, 'qd_image');
delete_post_thumbnail($q1);

wp_delete_attachment($att, true);
echo "OK\n";
