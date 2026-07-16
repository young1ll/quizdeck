<?php
/** 편집 화면 미리보기 — 다이어그램 SVG 실시간 미리보기 + 아이콘 필드 미리보기. */
require '/tests/_helpers.php';
echo "[85-edit-previews]\n";

$render = function (int $postId): string {
    ob_start();
    qd_render_metabox(get_post($postId));
    return ob_get_clean();
};

// 다이어그램: SVG 소스 마킹 + 미리보기 박스 + JS
$diag = get_posts(['post_type' => 'qd_diagram', 'post_status' => 'publish', 'numberposts' => 1])[0]->ID;
$html = $render($diag);
t_assert(str_contains($html, 'data-qd-svg-src'), 'SVG textarea 소스 마킹');
t_assert(str_contains($html, 'data-qd-svg-preview'), 'SVG 미리보기 박스');
t_assert(str_contains($html, '<span data-qd-icon-preview') === false, '다이어그램엔 아이콘 미리보기 요소 없음(필드 없음 — JS 셀렉터 문자열은 무해)');
t_assert(str_contains($html, 'renderSvg'), '실시간 갱신 JS 포함');

// 서비스·개념 카드: 아이콘 미리보기
$svc = (int) get_option('qd_test_service_id');
$html = $render($svc);
t_assert(str_contains($html, 'data-qd-icon-src') && str_contains($html, 'data-qd-icon-preview'), '서비스 아이콘 미리보기');
$card = get_posts(['post_type' => 'qd_concept', 'title' => 'Amazon EFS', 'post_status' => 'publish', 'numberposts' => 1])[0]->ID;
t_assert(str_contains($render($card), 'data-qd-icon-preview'), '카드 아이콘 미리보기');

// 문제집: qd_icon 필드 보유 → 미리보기
$exam = (int) get_option('qd_test_exam_id');
t_assert(str_contains($render($exam), 'data-qd-icon-preview'), '문제집 아이콘 미리보기');

// 문항: 지문 이미지 픽커(2026-07-16) — URL 입력 + 미디어 선택 버튼 + 미리보기
$q = get_posts(['post_type' => 'qd_question', 'post_status' => 'publish', 'numberposts' => 1])[0]->ID;
$html = $render($q);
t_assert(str_contains($html, 'name="qd_image"') && str_contains($html, 'data-qd-media-pick')
    && str_contains($html, 'data-qd-media-preview'), '문항 지문 이미지 픽커(입력·버튼·미리보기)');
echo "OK\n";
