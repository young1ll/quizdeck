<?php
/** 게시 게이트 — 잘못된 데이터가 published(서빙 계약)로 나가지 않는다. */
require '/tests/_helpers.php';
echo "[10-gates]\n";
$exam = (int) get_option('qd_test_exam_id');

// 정답⊄보기 → 강등
$id = t_post('qd_question', 'bad-answer', ['qd_exam_id' => (string) $exam, 'qd_qn' => '90', 'qd_q' => 'x',
    'qd_options' => '[{"key":"A","text":"a"},{"key":"B","text":"b"}]', 'qd_answer' => '["Z"]']);
t_assert(get_post_status($id) === 'draft', '정답⊄보기 → draft 강등');
wp_delete_post($id, true);

// (exam, qn) 중복 → 강등
$id = t_post('qd_question', 'dup-qn', ['qd_exam_id' => (string) $exam, 'qd_qn' => '1', 'qd_q' => 'x',
    'qd_options' => '[{"key":"A","text":"a"},{"key":"B","text":"b"}]', 'qd_answer' => '["A"]']);
t_assert(get_post_status($id) === 'draft', '(exam, qn) 중복 → draft 강등');
wp_delete_post($id, true);

// (provider, service_id) 중복 → 강등
$id = t_post('qd_service', 'dup-svc', ['qd_service_id' => 'amazon-efs', 'qd_provider' => 'aws', 'qd_name' => 'dup']);
t_assert(get_post_status($id) === 'draft', '(provider, service_id) 중복 → draft 강등');
wp_delete_post($id, true);

// 서비스 id 형식(ascii 안정 키) 위반 → 강등
$id = t_post('qd_service', 'bad-id', ['qd_service_id' => '한글Id', 'qd_provider' => 'aws', 'qd_name' => 'bad']);
t_assert(get_post_status($id) === 'draft', '서비스 id 형식 위반 → draft 강등');
wp_delete_post($id, true);

// 카드의 깨진 서비스 참조 → 강등
$id = t_post('qd_concept', 'bad-ref', ['qd_exam_id' => (string) $exam, 'qd_svc' => 'bad-ref', 'qd_ord' => '9',
    'qd_deff' => 'x', 'qd_service_ids' => '["no-such-svc"]']);
t_assert(get_post_status($id) === 'draft', '깨진 서비스 참조 → draft 강등');
t_assert((bool) preg_match('/no-such-svc/', implode(' ', get_transient("qd_errors_{$id}") ?: [])), '강등 사유에 참조 id 명시');
wp_delete_post($id, true);
echo "OK\n";
