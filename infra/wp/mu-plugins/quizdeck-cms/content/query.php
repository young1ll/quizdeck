<?php
/**
 * REST 목록 쿼리 필터 (3단계 서빙 계약). 코어 REST 는 meta 필터를 노출하지 않는다 —
 * 서빙 로더가 필요한 최소만 연다:
 *   qd-questions·qd-concepts: ?qd_exam=<wp exam id> (+questions 는 ?qd_qn_in=1,2,3)
 *   qd-exams: ?qd_exam_key=aws/saa-c03
 * 정렬: 서빙은 qn/ord 로 정렬해야 한다 — ?orderby=qd_qn|qd_ord 를 meta_value_num 으로 매핑.
 */

defined('ABSPATH') || exit;

add_filter('rest_qd_question_query', function (array $args, WP_REST_Request $req): array {
    return qd_apply_query_filters($args, $req, 'qd_qn');
}, 10, 2);

add_filter('rest_qd_concept_query', function (array $args, WP_REST_Request $req): array {
    return qd_apply_query_filters($args, $req, 'qd_ord');
}, 10, 2);

add_filter('rest_qd_diagram_query', function (array $args, WP_REST_Request $req): array {
    return qd_apply_query_filters($args, $req, 'qd_ord');
}, 10, 2);

// 서비스 레지스트리: provider 스코프 목록(ADR-0026) — ?qd_provider=aws
add_filter('rest_qd_service_query', function (array $args, WP_REST_Request $req): array {
    $provider = $req->get_param('qd_provider');
    if (is_string($provider) && $provider !== '') {
        $args['meta_query'][] = ['key' => 'qd_provider', 'value' => $provider];
    }
    return $args;
}, 10, 2);

add_filter('rest_qd_exam_query', function (array $args, WP_REST_Request $req): array {
    $key = $req->get_param('qd_exam_key');
    if (is_string($key) && $key !== '') {
        $args['meta_query'][] = ['key' => 'qd_exam_key', 'value' => $key];
    }
    return $args;
}, 10, 2);

function qd_apply_query_filters(array $args, WP_REST_Request $req, string $ordMeta): array
{
    $examId = $req->get_param('qd_exam');
    if (is_numeric($examId)) {
        $args['meta_query'][] = ['key' => 'qd_exam_id', 'value' => (string) (int) $examId];
    }
    $qnIn = $req->get_param('qd_qn_in');
    if (is_string($qnIn) && $qnIn !== '') {
        $qns = array_values(array_filter(array_map('intval', explode(',', $qnIn))));
        if ($qns) {
            $args['meta_query'][] = ['key' => 'qd_qn', 'value' => array_map('strval', $qns), 'compare' => 'IN'];
        }
    }
    // 코어 orderby 는 enum 화이트리스트라 커스텀 값이 400 — 별도 파라미터로 받는다.
    if ($req->get_param('qd_orderby') === 'num') {
        $args['meta_key'] = $ordMeta;
        $args['orderby']  = 'meta_value_num';
        $args['order']    = 'ASC';
    }
    return $args;
}
