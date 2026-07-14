<?php
/** REST 파생 계약 — rel/reln = q2svc 역인덱스, svc_icons = 레지스트리 오버레이 + 레거시 폴백. */
require '/tests/_helpers.php';
echo "[30-derivation]\n";
$exam = (int) get_option('qd_test_exam_id');

$concepts = t_rest('/wp/v2/qd-concepts', ['qd_exam' => $exam, 'qd_orderby' => 'num', 'per_page' => 100]);
$byKey = [];
foreach ($concepts as $c) $byKey[$c['qd']['svc']] = $c['qd'];

t_assert($byKey['Amazon EFS']['rel'] === [1, 2] && $byKey['Amazon EFS']['reln'] === 2,
    'rel/reln = q2svc 역인덱스 (EFS: [1,2]/2)');
t_assert($byKey['ALB vs NLB']['rel'] === [2] && $byKey['ALB vs NLB']['reln'] === 1,
    '묶음 카드도 동일 파생 (ALB: [2]/1)');
t_assert($byKey['Amazon EFS']['service_ids'] === ['amazon-efs'], '카드→서비스 참조 노출');

// q2svc 편집 → 다음 요청부터 반영: 역인덱스는 요청 스코프 static 캐시라 같은 프로세스에서는
// 구 값이 보인다(실서빙은 요청마다 새 프로세스). 편집만 여기서 하고 단언은 31(새 프로세스)에서.
update_post_meta($exam, 'qd_q2svc', wp_slash('{"1":["Amazon EFS"],"2":["Amazon EFS","ALB vs NLB"],"3":["Amazon EFS"]}'));

// svc_icons: 레지스트리(🗂️)가 레거시 블롭(📁)을 오버라이드, 미참조 카드는 블롭 폴백
$exams = t_rest('/wp/v2/qd-exams');
$icons = $exams[0]['qd']['svc_icons'];
t_assert($icons['Amazon EFS'] === '🗂️', '레지스트리 아이콘이 레거시 블롭 오버라이드');
t_assert($icons['ALB vs NLB'] === '⚖️', '미참조 카드는 레거시 블롭 폴백');

// 서비스 아이콘 수정 → transient 무효화 → 시험 응답 반영
$svc = (int) get_option('qd_test_service_id');
update_post_meta($svc, 'qd_icon', '🧪');
wp_update_post(['ID' => $svc, 'post_status' => 'publish']); // save_post → 캐시 전량 무효화
$exams = t_rest('/wp/v2/qd-exams');
t_assert($exams[0]['qd']['svc_icons']['Amazon EFS'] === '🧪', '서비스 아이콘 수정 → 캐시 무효화 → 즉시 반영');
echo "OK\n";
