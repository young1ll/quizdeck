<?php
/** 다이어그램 순서 시스템 소유(2026-07-16) — 자동 부여(max+1)·↑↓ 이동·중복 자가 치유·서빙 파생 반영. */
require '/tests/_helpers.php';
echo "[88-diagram-ordering]\n";

$exam = (int) get_option('qd_test_exam_id');
$ord  = fn(int $id): string => (string) get_post_meta($id, 'qd_ord', true);

// 메타박스 — 순서 입력이 없다(스키마 제외)
$anyDiag = get_posts(['post_type' => 'qd_diagram', 'post_status' => 'publish', 'numberposts' => 1])[0]->ID;
ob_start();
qd_render_metabox(get_post($anyDiag));
$html = ob_get_clean();
t_assert(str_contains($html, 'name="qd_ord"') === false, '메타박스에 순서 입력 없음(시스템 소유)');

// 자동 부여 — ord 없이 게시하면 시험 스코프 max+1 연속
$next = qd_diag_next_ord($exam);
$d2 = t_published('qd_diagram', 'ord-auto-a', ['qd_exam_id' => (string) $exam, 'qd_diag_id' => 'ord-a',
    'qd_svg' => '<svg xmlns="http://www.w3.org/2000/svg"/>']);
t_assert($ord($d2) === (string) $next, "자동 부여 = max+1 ({$next})");
$d3 = t_published('qd_diagram', 'ord-auto-b', ['qd_exam_id' => (string) $exam, 'qd_diag_id' => 'ord-b',
    'qd_svg' => '<svg xmlns="http://www.w3.org/2000/svg"/>']);
t_assert($ord($d3) === (string) ($next + 1), '자동 부여 연속 (+1)');

// ↑ 이동 — 인접 스왑: d3 이 d2 앞으로
t_assert(qd_diag_move($d3, 'up') === true, '이동 실행');
t_assert((int) $ord($d3) < (int) $ord($d2), '↑ 이동 = 인접 스왑(서열 역전)');

// 서빙 파생 반영 — 트랜지언트 무효화로 REST 파생(qd.diagrams)이 새 서열
$rows = t_rest('/wp/v2/qd-exams', ['qd_exam_key' => 'aws/test-01']);
$ids = array_column($rows[0]['qd']['diagrams'], 'id');
t_assert(array_search('ord-b', $ids, true) < array_search('ord-a', $ids, true), '이동이 서빙 파생에 즉시 반영');

// 경계 — 맨 아래에서 ↓ 는 서열 불변(정규화만)
$snap = [$ord($d2), $ord($d3)];
qd_diag_move($d2, 'down');
t_assert([$ord($d2), $ord($d3)] === $snap, '경계 이동 = 서열 불변');

// 중복 자가 치유 — 강제 중복 후 아무 이동이나 1..N 정규화(전 항목 distinct)
update_post_meta($d2, 'qd_ord', $ord($d3));
qd_diag_move($d2, 'down');
$all = get_posts(['post_type' => 'qd_diagram', 'post_status' => ['publish', 'draft'], 'numberposts' => -1,
    'fields' => 'ids', 'meta_query' => [['key' => 'qd_exam_id', 'value' => (string) $exam]]]);
$ords = array_map(fn(int $id): int => (int) $ord($id), $all);
sort($ords);
t_assert($ords === range(1, count($all)), '중복 자가 치유 — 1..N 정규화(' . implode(',', $ords) . ')');
echo "OK\n";
