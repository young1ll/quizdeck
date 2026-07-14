<?php
/** 픽스처 — 이후 케이스가 공유(케이스는 번호 순서로 실행된다). 게이트 통과 자체가 첫 검증. */
require '/tests/_helpers.php';
echo "[00-fixture]\n";

// 플러그인 정체성 — must-use 표면은 QuizDeck CMS 단일(통합 결정 2026-07-14)
$mu = get_mu_plugins();
t_assert(count($mu) === 1 && ($mu['quizdeck-cms-loader.php']['Name'] ?? '') === 'QuizDeck CMS',
    'must-use = QuizDeck CMS 단일 (' . implode(',', array_keys($mu)) . ')');

$exam = t_published('qd_exam', 'TEST-01', [
    'qd_provider' => 'aws', 'qd_slug' => 'test-01', 'qd_provider_name' => 'AWS', 'qd_code' => 'TEST-01',
    'qd_q2svc' => '{"1":["Amazon EFS"],"2":["Amazon EFS","ALB vs NLB"]}',
    'qd_svc_icons' => '{"Amazon EFS":"📁","ALB vs NLB":"⚖️"}',
]);
update_option('qd_test_exam_id', $exam);

foreach ([1, 2, 3] as $n) {
    t_published('qd_question', "Q{$n}", [
        'qd_exam_id' => (string) $exam, 'qd_qn' => (string) $n, 'qd_q' => "질문 {$n}",
        'qd_options' => '[{"key":"A","text":"a"},{"key":"B","text":"b"}]', 'qd_answer' => '["A"]',
    ]);
}

$svc = t_published('qd_service', 'Amazon EFS', [
    'qd_service_id' => 'amazon-efs', 'qd_provider' => 'aws', 'qd_name' => 'Amazon EFS', 'qd_icon' => '🗂️',
]);
update_option('qd_test_service_id', $svc);

t_published('qd_concept', 'Amazon EFS', ['qd_exam_id' => (string) $exam, 'qd_svc' => 'Amazon EFS',
    'qd_ord' => '1', 'qd_deff' => 'NFS', 'qd_service_ids' => '["amazon-efs"]']);
t_published('qd_concept', 'ALB vs NLB', ['qd_exam_id' => (string) $exam, 'qd_svc' => 'ALB vs NLB',
    'qd_ord' => '2', 'qd_deff' => '비교']);
echo "OK\n";
