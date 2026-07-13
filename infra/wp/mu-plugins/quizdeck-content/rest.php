<?php
/**
 * REST 계약 (서빙·이관 공용).
 *  - 읽기: 각 CPT 응답에 `qd` 단일 필드 — JSON 메타를 디코드한 타입 있는 구조.
 *    published 는 익명 read(서빙 3단계 계약), draft 는 인증 필요(WP 기본).
 *  - 쓰기: `qd` 필드로 통째로 받는다(이관 스크립트 — Application Password 인증,
 *    edit_posts 권한). 저장 후 qd_validate 를 거쳐 실패면 draft 강등(폼과 같은 게이트).
 */

defined('ABSPATH') || exit;

add_action('rest_api_init', function () {
    foreach (['qd_exam', 'qd_question', 'qd_concept'] as $type) {
        register_rest_field($type, 'qd', [
            'get_callback'    => fn(array $post) => qd_rest_projection($post['id'], $type),
            'update_callback' => fn($value, WP_Post $post) => qd_rest_ingest((array) $value, $post),
            'schema'          => ['type' => 'object', 'description' => 'QuizDeck 구조 필드(SSOT: fields.php)'],
        ]);
    }
});

function qd_rest_projection(int $postId, string $type): array
{
    $meta = fn(string $k): string => (string) get_post_meta($postId, $k, true);
    $out  = [];

    foreach (qd_field_schema()[$type] as $key => $def) {
        $raw  = $meta($key);
        $name = substr($key, 3); // qd_ 접두 제거
        if ($raw === '') { $out[$name] = null; continue; }
        $out[$name] = match ($def['type']) {
            'int'  => (int) $raw,
            'json' => json_decode($raw, true),
            default => $raw,
        };
    }

    if ($type === 'qd_question') {
        $out['exam_id'] = (int) $meta('qd_exam_id') ?: null;
        $out['options'] = json_decode($meta('qd_options'), true) ?: [];
        $out['answer']  = json_decode($meta('qd_answer'), true) ?: [];
        $thumb = get_the_post_thumbnail_url($postId, 'full');
        $out['image'] = $thumb ?: null;
    }
    if ($type === 'qd_concept') {
        $out['exam_id'] = (int) $meta('qd_exam_id') ?: null;
    }
    if ($type === 'qd_exam') {
        $out['exam_key'] = $meta('qd_exam_key') ?: null;
        // get_the_title 은 wptexturize 로 하이픈→&#8211; 등 원문을 바꾼다(diff 실사) — raw 로.
        $out['name']     = get_post_field('post_title', $postId, 'raw');
    }

    return $out;
}

/** REST 쓰기 — 이관 스크립트 전용 표면. 폼 저장과 같은 sanitize·검증 경로를 지난다. */
function qd_rest_ingest(array $value, WP_Post $post)
{
    if (!current_user_can('edit_post', $post->ID)) {
        return new WP_Error('qd_forbidden', '권한 없음', ['status' => 403]);
    }
    $type = $post->post_type;

    foreach (qd_field_schema()[$type] as $key => $def) {
        $name = substr($key, 3);
        if (!array_key_exists($name, $value)) continue;
        $incoming = $value[$name];
        $raw = $def['type'] === 'json' ? wp_json_encode($incoming, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : (string) ($incoming ?? '');
        [$clean, $err] = qd_sanitize_meta($def, $raw);
        if ($err) return new WP_Error('qd_invalid', $err, ['status' => 400]);
        if ($clean === null || $clean === '') delete_post_meta($post->ID, $key);
        // update_post_meta 는 인자를 unslash 한다 — 따옴표·백슬래시가 든 텍스트/JSON 이 깨지는
        // 고전 함정(qn50 실사: 저장된 qd_options 가 JSON Syntax error). 반드시 wp_slash.
        else update_post_meta($post->ID, $key, wp_slash($clean));
    }

    if (isset($value['exam_id'])) update_post_meta($post->ID, 'qd_exam_id', (string) (int) $value['exam_id']);
    if ($type === 'qd_question') {
        if (isset($value['options'])) update_post_meta($post->ID, 'qd_options', wp_slash(wp_json_encode($value['options'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)));
        if (isset($value['answer'])) update_post_meta($post->ID, 'qd_answer', wp_slash(wp_json_encode(array_values($value['answer']), JSON_UNESCAPED_UNICODE)));
    }

    // 게시 요청이면 폼과 같은 게이트 — 실패 시 draft 강등 + 에러 반환(이관 스크립트가 감지)
    $errors = qd_validate($post->ID, $type);
    $title  = qd_auto_title($post->ID, $type);
    if ($title && $title !== $post->post_title) {
        wp_update_post(['ID' => $post->ID, 'post_title' => $title]);
    }
    if ($errors && $post->post_status === 'publish') {
        wp_update_post(['ID' => $post->ID, 'post_status' => 'draft']);
        return new WP_Error('qd_validation', implode(' · ', $errors), ['status' => 400]);
    }
    return true;
}
