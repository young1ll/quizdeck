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
    foreach (['qd_exam', 'qd_question', 'qd_concept', 'qd_service', 'qd_diagram'] as $type) {
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
    $out  = ['wp_id' => $postId]; // 앱의 admin 편집 딥링크(post.php?post=) 용

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
    if ($type === 'qd_diagram') {
        $out['exam_id'] = (int) $meta('qd_exam_id') ?: null;
        $out['title']   = get_post_field('post_title', $postId, 'raw'); // wptexturize 함정 — raw
        $out['image']   = get_the_post_thumbnail_url($postId, 'full') ?: null; // SVG 의 래스터 대안
    }
    if ($type === 'qd_concept') {
        $out['exam_id'] = (int) $meta('qd_exam_id') ?: null;
        $out['image']   = get_the_post_thumbnail_url($postId, 'full') ?: null; // 카드 이미지

        // rel/reln 은 저장하지 않는다 — q2svc(단일 소스)에서 파생(ADR-0026). 봉투 계약은
        // 구 저장 필드와 동일(rel = 오름차순 최대 40개, reln = 총수)이라 앱 무변경.
        [$out['rel'], $out['reln']] = qd_derived_rel((int) $meta('qd_exam_id'), $meta('qd_svc'));
    }
    if ($type === 'qd_service') {
        $thumb = get_the_post_thumbnail_url($postId, 'full');
        if ($thumb) $out['icon'] = $thumb; // 대표이미지가 데이터 URI 를 대체(유효 아이콘 단일 필드)
    }
    if ($type === 'qd_exam') {
        $out['exam_key'] = $meta('qd_exam_key') ?: null;
        $thumb = get_the_post_thumbnail_url($postId, 'full');
        if ($thumb) $out['icon'] = $thumb; // 이미지 아이콘 우선(서비스와 같은 유효 아이콘 규율)
        // get_the_title 은 wptexturize 로 하이픈→&#8211; 등 원문을 바꾼다(diff 실사) — raw 로.
        $out['name']     = get_post_field('post_title', $postId, 'raw');
        // svc_icons = 엔티티 파생(카드 오버라이드 > 서비스 대표이미지 > 서비스 qd_icon)
        // + 휴면 레거시 블롭 폴백(이관 후 잉여 — 편집 표면 없음, 가역성용).
        $out['svc_icons'] = qd_derived_icons($postId) + (json_decode($meta('qd_svc_icons'), true) ?: []);
        // diagrams = qd_diagram CPT 파생(봉투 계약 = 구 블롭과 동일 — 앱 무변경).
        $out['diagrams'] = qd_derived_diagrams($postId);
    }

    return $out;
}

/** exam 의 다이어그램 배열 — CPT 파생(qd_ord 순). CPT 0건이면 구 블롭 폴백(이관 전 무공백). */
function qd_derived_diagrams(int $examId): array
{
    $cached = get_transient("qd_diagrams_{$examId}");
    if (is_array($cached)) return $cached;

    $out = [];
    $posts = get_posts([
        'post_type'   => 'qd_diagram',
        'post_status' => 'publish',
        'numberposts' => -1,
        'meta_key'    => 'qd_ord',
        'orderby'     => 'meta_value_num',
        'order'       => 'ASC',
        'meta_query'  => [['key' => 'qd_exam_id', 'value' => (string) $examId]],
    ]);
    foreach ($posts as $p) {
        $item = [
            'wp_id'   => $p->ID,
            'id'      => (string) get_post_meta($p->ID, 'qd_diag_id', true),
            'title'   => get_post_field('post_title', $p->ID, 'raw'),
            'cat'     => (string) get_post_meta($p->ID, 'qd_cat', true),
            'caption' => (string) get_post_meta($p->ID, 'qd_caption', true),
            'svg'     => (string) get_post_meta($p->ID, 'qd_svg', true),
        ];
        $img = get_the_post_thumbnail_url($p->ID, 'full');
        if ($img) $item['image'] = $img;
        $out[] = $item;
    }
    if (!$out) {
        $out = json_decode((string) get_post_meta($examId, 'qd_diagrams', true), true) ?: [];
    }
    set_transient("qd_diagrams_{$examId}", $out, DAY_IN_SECONDS);
    return $out;
}

/** exam q2svc 의 역인덱스(svc → 오름차순 qn 목록) — 요청 스코프 static 캐시. */
function qd_q2svc_inverse(int $examId): array
{
    static $cache = [];
    if (isset($cache[$examId])) return $cache[$examId];
    $q2svc = json_decode((string) get_post_meta($examId, 'qd_q2svc', true), true) ?: [];
    $inv = [];
    foreach ($q2svc as $qn => $svcs) {
        foreach ((array) $svcs as $svc) $inv[$svc][] = (int) $qn;
    }
    foreach ($inv as &$qns) sort($qns);
    return $cache[$examId] = $inv;
}

/** 카드의 관련 문항 파생 — [rel(최대 40), reln(총수)]. 구 저장 필드의 표시 계약과 동일. */
function qd_derived_rel(int $examId, string $svc): array
{
    if (!$examId || $svc === '') return [null, null];
    $qns = qd_q2svc_inverse($examId)[$svc] ?? [];
    if (!$qns) return [null, null];
    return [array_slice($qns, 0, 40), count($qns)];
}

/** 카드 키 → 첫 참조 서비스의 아이콘 맵 — DB 조회가 있어 transient 캐시(저장 시 무효화, save.php). */
function qd_derived_icons(int $examId): array
{
    $cached = get_transient("qd_icons_{$examId}");
    if (is_array($cached)) return $cached;

    $provider = (string) get_post_meta($examId, 'qd_provider', true);
    $icons = [];
    if ($provider !== '') {
        $cards = get_posts([
            'post_type'   => 'qd_concept',
            'post_status' => 'publish',
            'numberposts' => -1,
            'fields'      => 'ids',
            'meta_query'  => [['key' => 'qd_exam_id', 'value' => (string) $examId]],
        ]);
        foreach ($cards as $cid) {
            // 우선순위: 카드 자체 아이콘(오버라이드) > 첫 참조 서비스의 대표이미지 > 서비스 qd_icon
            $icon = (string) get_post_meta($cid, 'qd_icon', true);
            if ($icon === '') {
                $sids = json_decode((string) get_post_meta($cid, 'qd_service_ids', true), true) ?: [];
                if ($sids && is_string($sids[0]) && ($serviceId = qd_find_service($provider, $sids[0]))) {
                    $icon = get_the_post_thumbnail_url($serviceId, 'full')
                        ?: (string) get_post_meta($serviceId, 'qd_icon', true);
                }
            }
            if ($icon !== '') $icons[(string) get_post_meta($cid, 'qd_svc', true)] = $icon;
        }
    }
    set_transient("qd_icons_{$examId}", $icons, DAY_IN_SECONDS);
    return $icons;
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
    // 다이어그램 순서 자동 부여 — 스키마 제외(fields.php)로 REST 봉투에 ord 가 없다. exam 확정 직후 여기서.
    if ($type === 'qd_diagram' && (string) get_post_meta($post->ID, 'qd_ord', true) === '') {
        $eid = (int) get_post_meta($post->ID, 'qd_exam_id', true);
        if ($eid) update_post_meta($post->ID, 'qd_ord', (string) qd_diag_next_ord($eid));
    }
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
        qd_demoting(true); // 자동 강등 — qn 셰도우 유지(save.php 게이트 규율과 동일)
        wp_update_post(['ID' => $post->ID, 'post_status' => 'draft']);
        qd_demoting(false);
        return new WP_Error('qd_validation', implode(' · ', $errors), ['status' => 400]);
    }
    if ($post->post_status === 'publish' && $type === 'qd_question') {
        update_post_meta($post->ID, 'qd_qn_published', (string) get_post_meta($post->ID, 'qd_qn', true));
    }
    return true;
}
