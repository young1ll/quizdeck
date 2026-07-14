<?php
/**
 * 편집 → 앱 revalidate 웹훅 (3단계 — Payload afterChange 훅의 WP 등가).
 * 문항/개념/문제집이 게시본에 영향을 주는 변화(게시·게시본 갱신·게시 해제·삭제)를 겪으면
 * 앱의 /api/revalidate-content 로 examKey 를 쏜다(클러스터 내부 URL — env QD_REVALIDATE_URL,
 * 공유 토큰 env QD_REVALIDATE_TOKEN). env 미설정(로컬 등)이면 조용히 무시.
 * 초안 저장(autosave 포함)은 게시본 불변 — 쏘지 않는다(Payload 때와 같은 규율).
 */

defined('ABSPATH') || exit;

add_action('transition_post_status', function (string $new, string $old, WP_Post $post): void {
    if (!in_array($post->post_type, ['qd_question', 'qd_concept', 'qd_exam'], true)) return;
    // 게시본에 영향 = 어느 쪽이든 publish 가 관여할 때만(draft↔draft 는 무시)
    if ($new !== 'publish' && $old !== 'publish') return;
    qd_fire_revalidate($post);
}, 10, 3);

// publish 상태에서의 내용 수정(상태 전이 없음) — save_post 로 잡는다.
add_action('save_post', function (int $postId, WP_Post $post): void {
    if (!in_array($post->post_type, ['qd_question', 'qd_concept', 'qd_exam'], true)) return;
    if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) return;
    if (wp_is_post_revision($postId)) return;
    if ($post->post_status !== 'publish') return;
    qd_fire_revalidate($post);
}, 99, 2); // 99 — 메타 저장(qd_handle_save)·REST ingest 이후

function qd_fire_revalidate(WP_Post $post): void
{
    $url   = getenv('QD_REVALIDATE_URL');
    $token = getenv('QD_REVALIDATE_TOKEN');
    if (!$url || !$token) return;

    if ($post->post_type === 'qd_exam') {
        $examKey = (string) get_post_meta($post->ID, 'qd_exam_key', true);
    } else {
        $examId  = (int) get_post_meta($post->ID, 'qd_exam_id', true);
        $examKey = $examId ? (string) get_post_meta($examId, 'qd_exam_key', true) : '';
    }
    if ($examKey === '') return;

    // 한 요청에서 같은 examKey 중복 발사 방지(transition + save_post 이중 훅)
    static $fired = [];
    if (isset($fired[$examKey])) return;
    $fired[$examKey] = true;

    wp_remote_post($url, [
        'timeout'  => 3,
        'blocking' => false, // 편집 응답을 앱 가용성에 묶지 않는다
        'headers'  => ['Content-Type' => 'application/json', 'X-QD-Token' => $token],
        'body'     => wp_json_encode(['examKey' => $examKey]),
    ]);
}
