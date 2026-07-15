<?php
/** 주제 스코프 — 필터(시험 스코프·optgroup) + 편집 datalist(기존 선택·신규 입력). */
require '/tests/_helpers.php';
echo "[87-topic-scoping]\n";
$exam = (int) get_option('qd_test_exam_id');

// 픽스처 문항에 주제 부여 + 제2 시험(다른 주제 체계)으로 섞임 재현
foreach ([1 => '📦 스토리지', 2 => '📦 스토리지', 3 => '🌐 네트워킹'] as $qn => $topic) {
    $q = get_posts(['post_type' => 'qd_question', 'title' => "Q{$qn}", 'post_status' => 'publish', 'numberposts' => 1])[0]->ID;
    update_post_meta($q, 'qd_topic', wp_slash($topic));
}
$exam2 = t_published('qd_exam', 'TEST-03', ['qd_provider' => 'aws', 'qd_slug' => 'test-03', 'qd_provider_name' => 'AWS', 'qd_code' => 'TEST-03']);
t_published('qd_question', 'Q1-e2', ['qd_exam_id' => (string) $exam2, 'qd_qn' => '1', 'qd_q' => 'x',
    'qd_options' => '[{"key":"A","text":"a"},{"key":"B","text":"b"}]', 'qd_answer' => '["A"]', 'qd_topic' => '📦 스토리지/백업']);

// 1) distinct 시험 스코프
$t1 = qd_admin_distinct_meta('qd_question', 'qd_topic', $exam);
t_assert($t1 === ['🌐 네트워킹', '📦 스토리지'] || $t1 === ['📦 스토리지', '🌐 네트워킹'],
    '시험 스코프 distinct (TEST-01 주제 2종만)');

// 2) 필터: 시험 선택 → 그 시험 주제만 (다른 시험 체계 미노출)
$_GET['qd_f_exam'] = (string) $exam;
ob_start(); do_action('restrict_manage_posts', 'qd_question', 'top'); $html = ob_get_clean();
t_assert(str_contains($html, '📦 스토리지') && !str_contains($html, '스토리지/백업'), '시험 선택 시 주제 스코프');
t_assert(!str_contains($html, '<optgroup'), '시험 선택 시 optgroup 없음(단일 체계)');

// 3) 필터: 전체 보기 → 시험별 optgroup 으로 체계 구분
unset($_GET['qd_f_exam']);
ob_start(); do_action('restrict_manage_posts', 'qd_question', 'top'); $html = ob_get_clean();
t_assert(substr_count($html, '<optgroup') >= 2 && str_contains($html, 'label="TEST-01"') && str_contains($html, 'label="TEST-03"'),
    '전체 보기 = 시험별 optgroup');

// 4) 편집 화면 datalist — 소속 시험의 기존 주제 제시 + 자유 입력(input type=text)
// (자동 제목이 "Q{qn}" 이라 두 시험의 문항이 같은 제목 — meta 로 정확히 집는다)
$q1 = get_posts(['post_type' => 'qd_question', 'post_status' => 'publish', 'numberposts' => 1, 'fields' => 'ids',
    'meta_query' => [['key' => 'qd_exam_id', 'value' => (string) $exam], ['key' => 'qd_qn', 'value' => '1']]])[0];
ob_start(); qd_render_metabox(get_post($q1)); $html = ob_get_clean();
t_assert(str_contains($html, '<select name="qd_topic"'), '주제 = 표준 select (WP 네이티브)');
t_assert(str_contains($html, '__new__') && str_contains($html, 'qd_topic_new'), "'새 주제 직접 입력' 경로");
t_assert(substr_count($html, '<option value="📦') === 1 && !str_contains($html, '스토리지/백업'),
    'select 옵션 = 소속 시험 주제만');
t_assert(str_contains($html, 'selected'), '현재값 선택 상태');
t_assert(!str_contains($html, 'data-qd-topic-chips') && !str_contains($html, '<datalist id="qd-topic-options"'),
    '칩·datalist 제거됨');

// 5) 저장 정규화(순수 함수) — select 값 그대로 / __new__ 면 새 텍스트
t_assert(qd_topic_from_post(['qd_topic' => '📦 스토리지']) === '📦 스토리지', '정규화: 기존 선택');
t_assert(qd_topic_from_post(['qd_topic' => '__new__', 'qd_topic_new' => ' 🧭 신규 ']) === '🧭 신규', '정규화: 새 주제(트림)');
t_assert(qd_topic_from_post(['qd_topic' => '__new__']) === '', '정규화: 새 주제 미입력 → 빈 값');

wp_delete_post($exam2, true);
foreach (get_posts(['post_type' => 'qd_question', 'title' => 'Q1-e2', 'post_status' => 'any', 'numberposts' => 1, 'fields' => 'ids']) as $id) wp_delete_post($id, true);
echo "OK\n";
