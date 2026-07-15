<?php
/** 목록 컬럼 통일 — 문제집·문항·개념 카드·다이어그램(서비스는 83). */
require '/tests/_helpers.php';
echo "[84-list-columns]\n";
$exam = (int) get_option('qd_test_exam_id');

$cell = function (string $type, string $col, int $id): string {
    ob_start();
    do_action("manage_{$type}_posts_custom_column", $col, $id);
    return ob_get_clean();
};

// 문제집: 아이콘·provider·코드·문항 수
$cols = apply_filters('manage_qd_exam_posts_columns', ['cb' => '', 'title' => '', 'date' => '']);
t_assert(isset($cols['qd_col_icon'], $cols['qd_provider'], $cols['qd_code'], $cols['qd_col_qcount']), '문제집 컬럼 4종');
t_assert(str_contains($cell('qd_exam', 'qd_code', $exam), 'TEST-01'), '문제집 코드 셀');
t_assert(trim(strip_tags($cell('qd_exam', 'qd_col_qcount', $exam))) === '3', '문제집 문항 수 셀 (3)');

// 문항: 문제집·번호·주제·이미지
$q1 = get_posts(['post_type' => 'qd_question', 'title' => 'Q1', 'post_status' => 'publish', 'numberposts' => 1])[0]->ID;
$cols = apply_filters('manage_qd_question_posts_columns', ['cb' => '', 'title' => '', 'date' => '']);
t_assert(isset($cols['qd_exam'], $cols['qd_qn'], $cols['qd_topic'], $cols['qd_col_icon']), '문항 컬럼 4종');
t_assert(str_contains($cell('qd_question', 'qd_exam', $q1), 'TEST-01'), '문항 문제집 셀');
t_assert($cell('qd_question', 'qd_qn', $q1) === '1', '문항 번호 셀');

// 개념 카드: 아이콘(카드>서비스 파생)·문제집·분류·참조 서비스(미참조 경고)
$efs = get_posts(['post_type' => 'qd_concept', 'title' => 'Amazon EFS', 'post_status' => 'publish', 'numberposts' => 1])[0]->ID;
$alb = get_posts(['post_type' => 'qd_concept', 'title' => 'ALB vs NLB', 'post_status' => 'publish', 'numberposts' => 1])[0]->ID;
t_assert(str_contains($cell('qd_concept', 'qd_col_services', $efs), 'amazon-efs'), '카드 참조 서비스 셀');
t_assert(str_contains($cell('qd_concept', 'qd_col_services', $alb), '미참조'), '미참조 카드 경고 표시');
t_assert($cell('qd_concept', 'qd_col_icon', $efs) !== '—', '카드 아이콘 셀 = 서비스 파생 (자체 아이콘 없음)');

// 다이어그램: 문제집·분류·형식·순서
$diag = get_posts(['post_type' => 'qd_diagram', 'post_status' => 'publish', 'numberposts' => 1])[0]->ID;
t_assert($cell('qd_diagram', 'qd_col_format', $diag) === 'SVG', '다이어그램 형식 셀 (SVG)');
t_assert($cell('qd_diagram', 'qd_ord', $diag) === '1', '다이어그램 순서 셀');

// 정렬 등록(숫자 포함)
$s = apply_filters('manage_edit-qd_question_sortable_columns', []);
t_assert(isset($s['qd_qn']), '문항 번호 정렬 등록');
$s = apply_filters('manage_edit-qd_diagram_sortable_columns', []);
t_assert(isset($s['qd_ord'], $s['qd_cat']), '다이어그램 순서·분류 정렬 등록');
echo "OK\n";
