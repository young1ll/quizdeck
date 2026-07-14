<?php
/** admin 대시보드 — 집계·점검 헬퍼와 렌더 스모크(경계: env 는 상태만, 액션은 왕복 검증). */
require '/tests/_helpers.php';
echo "[50-admin]\n";

$stats = qd_dashboard_stats();
t_assert($stats['counts']['qd_exam']['publish'] === 1 && $stats['counts']['qd_question']['publish'] === 3
    && $stats['counts']['qd_concept']['publish'] === 2 && $stats['counts']['qd_service']['publish'] === 1,
    '카운트 집계 (시험1·문항3·카드2·서비스1)');
t_assert($stats['counts']['qd_question']['draft'] === 0, '초안 0 (게이트 강등 잔재 없음)');
t_assert(count($stats['unlinked']) === 1 && $stats['unlinked'][0]['svc'] === 'ALB vs NLB',
    '편집 큐: 서비스 미참조 카드 = ALB vs NLB');
t_assert($stats['unmapped']['aws/test-01'] === [], 'q2svc 미연결 문항 0 (1·2·3 전부 매핑)');

[$ok, $detail] = qd_dashboard_r2_test();
t_assert($ok === true, "R2 연결 테스트 왕복 ({$detail})");

[$ok, $detail] = qd_dashboard_revalidate_all();
t_assert($ok === false && str_contains($detail, '미설정'), '웹훅 env 부재 → 미설정 보고 (발사 안 함)');

ob_start();
qd_render_dashboard();
$html = ob_get_clean();
t_assert(str_contains($html, 'QuizDeck CMS') && str_contains($html, qd_plugin_version()), '대시보드 렌더 (이름·버전)');
t_assert(str_contains($html, 'ALB vs NLB'), '대시보드에 편집 큐 노출');
echo "OK\n";
