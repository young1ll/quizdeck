<?php
/** 30 에서 편집한 q2svc 가 새 요청(프로세스)에서 파생에 반영되는가 — rel 이 저장 데이터가 아님을 증명. */
require '/tests/_helpers.php';
echo "[31-derivation-fresh]\n";
$exam = (int) get_option('qd_test_exam_id');

$concepts = t_rest('/wp/v2/qd-concepts', ['qd_exam' => $exam, 'qd_orderby' => 'num', 'per_page' => 100]);
foreach ($concepts as $c) if ($c['qd']['svc'] === 'Amazon EFS') {
    t_assert($c['qd']['rel'] === [1, 2, 3] && $c['qd']['reln'] === 3, 'q2svc 편집 → 새 요청에서 rel 파생 갱신');
}
echo "OK\n";
