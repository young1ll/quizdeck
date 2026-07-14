<?php
/** qn 불변 게이트 5 시나리오 — 학습자 데이터의 (examKey, qn) 참조 보호. */
require '/tests/_helpers.php';
echo "[20-qn-immutable]\n";
$q1 = get_posts(['post_type' => 'qd_question', 'title' => 'Q1', 'post_status' => 'publish', 'numberposts' => 1])[0]->ID;

t_assert(get_post_meta($q1, 'qd_qn_published', true) === '1', '게시 시점 셰도우 기록');

update_post_meta($q1, 'qd_qn', '9');
wp_update_post(['ID' => $q1, 'post_status' => 'publish']);
t_assert(get_post_status($q1) === 'draft', '게시 중 qn 변경 → draft 강등');
t_assert(get_post_meta($q1, 'qd_qn_published', true) === '1', '자동 강등은 셰도우 유지(게이트 자기 우회 방지)');

update_post_meta($q1, 'qd_qn', '1');
wp_update_post(['ID' => $q1, 'post_status' => 'publish']);
t_assert(get_post_status($q1) === 'publish', 'qn 복원 재게시 통과');

wp_update_post(['ID' => $q1, 'post_status' => 'draft']); // 사용자 초안 전환 = 탈출구
t_assert(get_post_meta($q1, 'qd_qn_published', true) === '', '사용자 초안 전환 → 셰도우 해제');
update_post_meta($q1, 'qd_qn', '9');
wp_update_post(['ID' => $q1, 'post_status' => 'publish']);
t_assert(get_post_status($q1) === 'publish' && get_post_meta($q1, 'qd_qn_published', true) === '9',
    '초안 경유 변경 재게시 통과 + 새 셰도우');

wp_trash_post($q1);
t_assert(get_post_meta($q1, 'qd_qn_published', true) === '', '휴지통 → 셰도우 해제');
t_assert((bool) get_transient('qd_trash_notice_' . get_current_user_id()), '휴지통 경고 알림 적재');
wp_untrash_post($q1);
update_post_meta($q1, 'qd_qn', '1');
wp_update_post(['ID' => $q1, 'post_status' => 'publish']);
t_assert(get_post_status($q1) === 'publish', '복원 후 재게시(픽스처 원상)');
echo "OK\n";
