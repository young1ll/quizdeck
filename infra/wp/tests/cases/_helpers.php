<?php
/** 테스트 공용 — 단언·픽스처 헬퍼. wp eval-file 로 각 케이스에서 require. */

function t_assert(bool $cond, string $msg): void
{
    if ($cond) { echo "  PASS {$msg}\n"; return; }
    echo "  FAIL {$msg}\n";
    exit(1);
}

/** draft 삽입→meta→publish 승격 — save_post 게이트 규율(즉시 발화 함정 회피). */
function t_post(string $type, string $title, array $meta, string $status = 'publish'): int
{
    $id = wp_insert_post(['post_type' => $type, 'post_status' => 'draft', 'post_title' => $title]);
    foreach ($meta as $k => $v) update_post_meta($id, $k, wp_slash($v));
    if ($status !== 'draft') wp_update_post(['ID' => $id, 'post_status' => $status]);
    return $id;
}

/** 게시 성공 단언 포함 생성. */
function t_published(string $type, string $title, array $meta): int
{
    $id = t_post($type, $title, $meta);
    t_assert(get_post_status($id) === 'publish',
        "{$type} '{$title}' 게시 (" . implode('·', get_transient("qd_errors_{$id}") ?: []) . ")");
    return $id;
}

/** in-process REST GET — 익명(CLI uid 0) = 서빙 계약과 동일 시야. */
function t_rest(string $route, array $params = []): array
{
    $req = new WP_REST_Request('GET', $route);
    if ($params) $req->set_query_params($params);
    $res = rest_do_request($req);
    return rest_get_server()->response_to_data($res, false);
}
