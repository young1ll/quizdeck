<?php
/** qd_diagram CPT — 게이트·파생(봉투 계약)·레거시 블롭 폴백·캐시 무효화. */
require '/tests/_helpers.php';
echo "[80-diagrams]\n";
$exam = (int) get_option('qd_test_exam_id');

// 파생 — exam 투영의 diagrams 가 CPT 에서 조립(구 블롭과 같은 봉투)
$exams = t_rest('/wp/v2/qd-exams');
$byKey = [];
foreach ($exams as $e) $byKey[$e['qd']['exam_key']] = $e['qd'];
$d = $byKey['aws/test-01']['diagrams'];
t_assert(count($d) === 1 && $d[0]['id'] === 'test-diagram' && $d[0]['title'] === '테스트 구성도'
    && $d[0]['cat'] === '네트워킹' && str_contains($d[0]['svg'], '<svg'), 'exam 투영 diagrams = CPT 파생(봉투 동일)');

// 게이트 — svg 마크업 검증·(exam, diag_id) 유일성
$id = t_post('qd_diagram', 'bad-svg', ['qd_exam_id' => (string) $exam, 'qd_diag_id' => 'bad-svg',
    'qd_ord' => '2', 'qd_svg' => 'not-svg-markup']);
t_assert(get_post_status($id) === 'draft', 'SVG 아님 → draft 강등');
wp_delete_post($id, true);
$id = t_post('qd_diagram', 'dup', ['qd_exam_id' => (string) $exam, 'qd_diag_id' => 'test-diagram',
    'qd_ord' => '3', 'qd_svg' => '<svg xmlns="http://www.w3.org/2000/svg"/>']);
t_assert(get_post_status($id) === 'draft', '(exam, diag_id) 중복 → draft 강등');
wp_delete_post($id, true);

// 레거시 블롭 폴백 — CPT 0건 시험은 구 qd_diagrams meta 를 읽는다(이관 전 무공백)
$exam2 = t_published('qd_exam', 'TEST-02', ['qd_provider' => 'aws', 'qd_slug' => 'test-02',
    'qd_provider_name' => 'AWS', 'qd_code' => 'TEST-02']);
update_post_meta($exam2, 'qd_diagrams', wp_slash('[{"id":"legacy-1","title":"레거시","cat":"c","caption":"","svg":"<svg/>"}]'));
delete_transient("qd_diagrams_{$exam2}");
$exams = t_rest('/wp/v2/qd-exams');
foreach ($exams as $e) if ($e['qd']['exam_key'] === 'aws/test-02') {
    t_assert($e['qd']['diagrams'][0]['id'] === 'legacy-1', '레거시 블롭 폴백 (CPT 0건 시험)');
}
wp_delete_post($exam2, true);

// 캐시 무효화 — 다이어그램 편집 → 저장 → exam 투영 즉시 반영
$diag = get_posts(['post_type' => 'qd_diagram', 'post_status' => 'publish', 'numberposts' => 1])[0]->ID;
update_post_meta($diag, 'qd_caption', '수정된 캡션');
wp_update_post(['ID' => $diag, 'post_status' => 'publish']); // save_post → 캐시 전량 무효화
$exams = t_rest('/wp/v2/qd-exams');
foreach ($exams as $e) if ($e['qd']['exam_key'] === 'aws/test-01') {
    t_assert($e['qd']['diagrams'][0]['caption'] === '수정된 캡션', '편집 → 캐시 무효화 → 즉시 반영');
}
echo "OK\n";
