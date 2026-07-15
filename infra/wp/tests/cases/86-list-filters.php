<?php
/** 목록 필터 — 드롭다운 렌더 + meta_query 변환(순수 함수) + 실쿼리 의미론. */
require '/tests/_helpers.php';
echo "[86-list-filters]\n";
$exam = (int) get_option('qd_test_exam_id');

// 렌더 — 유형별 드롭다운 구성
$render = function (string $type): string {
    ob_start();
    do_action('restrict_manage_posts', $type, 'top');
    return ob_get_clean();
};
t_assert(substr_count($render('qd_concept'), '<select') === 3, '카드 필터 3종 (문제집·분류·참조 상태)');
t_assert(str_contains($render('qd_concept'), '미참조(편집 큐)'), '미참조 옵션 노출');
t_assert(substr_count($render('qd_question'), '<select') === 2, '문항 필터 2종 (문제집·주제)');
t_assert(substr_count($render('qd_diagram'), '<select') === 3, '다이어그램 필터 3종');
t_assert(str_contains($render('qd_service'), '스토리지'), '서비스 분류 옵션 = distinct meta');

// 변환 — 순수 함수
$mq = qd_admin_filter_meta_query(['qd_f_exam' => (string) $exam, 'qd_f_ref' => 'unref']);
t_assert(count($mq) === 2 && $mq[1]['relation'] === 'OR', '변환: exam + 미참조(OR NOT EXISTS/[])');

// 의미론 — 실쿼리: 미참조 = ALB vs NLB 만, 참조 = EFS 만
$ids = fn(array $extra) => array_map(
    fn($p) => get_post_meta($p, 'qd_svc', true),
    get_posts(['post_type' => 'qd_concept', 'post_status' => 'publish', 'numberposts' => -1, 'fields' => 'ids',
        'meta_query' => array_merge([['key' => 'qd_exam_id', 'value' => (string) $exam]], $extra)])
);
$unref = $ids(qd_admin_filter_meta_query(['qd_f_ref' => 'unref']));
t_assert($unref === ['ALB vs NLB'], '실쿼리: 미참조 = ALB vs NLB (' . implode(',', $unref) . ')');
$ref = $ids(qd_admin_filter_meta_query(['qd_f_ref' => 'ref']));
t_assert($ref === ['Amazon EFS'], '실쿼리: 참조됨 = Amazon EFS');
// 형식 필터: 픽스처 다이어그램은 SVG
$diags = get_posts(['post_type' => 'qd_diagram', 'post_status' => 'publish', 'numberposts' => -1, 'fields' => 'ids',
    'meta_query' => qd_admin_filter_meta_query(['qd_f_format' => 'svg'])]);
t_assert(count($diags) === 1, '실쿼리: 형식=SVG → 픽스처 다이어그램 1건');
echo "OK\n";
