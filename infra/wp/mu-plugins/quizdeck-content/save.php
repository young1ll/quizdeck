<?php
/**
 * 저장 + 검증. WP 의 save_post 는 "이미 저장된 뒤" 불리므로, 검증 실패 시의 계약은:
 *   메타는 저장하되 게시 상태를 draft 로 강등 + 관리자 알림(transient) — 잘못된 데이터가
 *   published(=서빙 계약)로 나가는 일이 구조적으로 없다. Payload 때의 "초안은 자유, 게시가
 *   게이트"와 같은 규율이다.
 * 검증: 필수 필드 · 보기≥2 · 정답⊆보기(UI 가 막지만 REST 경유 저장도 이 경로를 지난다) ·
 *       (문제집, qn)·(문제집, svc) 유일성.
 */

defined('ABSPATH') || exit;

add_action('save_post', 'qd_handle_save', 10, 2);

function qd_handle_save(int $postId, WP_Post $post): void
{
    $schema = qd_field_schema();
    if (!isset($schema[$post->post_type])) return;
    if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) return;
    if (wp_is_post_revision($postId)) return;
    // REST 저장은 rest.php 의 qd_rest_ingest 가 게이트를 소유한다 — save_post 는 필드 콜백보다
    // 먼저 불려 "메타가 아직 없는" 상태를 검증하게 되고, 그러면 정상 생성도 draft 로 강등된다
    // (로컬 계약 테스트 실사 2026-07-13).
    if (defined('REST_REQUEST') && REST_REQUEST) return;
    // REST 경유 저장(이관 스크립트)은 nonce 가 없다 — meta 는 rest.php 의 register_post_meta 가
    // 처리하고, 여기서는 검증만 통과시킨다. 폼 저장일 때만 $_POST 메타를 기록한다.
    $isForm = isset($_POST['qd_nonce']) && wp_verify_nonce($_POST['qd_nonce'], 'qd_save');

    $errors = [];

    if ($isForm) {
        // ── 관계 ──
        if (in_array($post->post_type, ['qd_question', 'qd_concept'], true)) {
            $examId = (int) ($_POST['qd_exam_id'] ?? 0);
            if ($examId && get_post_type($examId) === 'qd_exam') {
                update_post_meta($postId, 'qd_exam_id', (string) $examId);
            } else {
                $errors[] = '문제집을 선택하세요';
            }
        }
        // ── 스키마 필드 ──
        foreach ($schema[$post->post_type] as $key => $def) {
            [$value, $err] = qd_sanitize_meta($def, wp_unslash($_POST[$key] ?? ''));
            if ($err) { $errors[] = $err; continue; }
            if ($value === null || $value === '') {
                delete_post_meta($postId, $key);
            } else {
                update_post_meta($postId, $key, wp_slash($value)); // unslash 함정 — rest.php 참조
            }
        }
        // ── 문항: 보기 repeater + 정답 ──
        if ($post->post_type === 'qd_question') {
            $keys  = array_map('sanitize_text_field', wp_unslash($_POST['qd_opt_key'] ?? []));
            $texts = array_map(fn($v) => str_replace(["\r\n", "\r"], "\n", $v), wp_unslash($_POST['qd_opt_text'] ?? [])); // 원문 보존 — fields.php 참조
            $options = [];
            foreach ($keys as $i => $k) {
                $k = trim($k);
                if ($k === '') continue;
                $options[] = ['key' => $k, 'text' => trim($texts[$i] ?? '')];
            }
            $answer = array_values(array_map('sanitize_text_field', wp_unslash($_POST['qd_answer'] ?? [])));
            update_post_meta($postId, 'qd_options', wp_slash(wp_json_encode($options, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)));
            update_post_meta($postId, 'qd_answer', wp_slash(wp_json_encode($answer, JSON_UNESCAPED_UNICODE)));
        }
    }

    $errors = array_merge($errors, qd_validate($postId, $post->post_type));

    // ── 제목 자동 생성(식별 표면) + 검증 실패 시 draft 강등 ──
    remove_action('save_post', 'qd_handle_save', 10);
    $title = qd_auto_title($postId, $post->post_type);
    $update = ['ID' => $postId];
    if ($title && $title !== $post->post_title) $update['post_title'] = $title;
    if ($errors && $post->post_status === 'publish') {
        $update['post_status'] = 'draft';
        set_transient("qd_errors_{$postId}", $errors, 60);
    }
    if (count($update) > 1) wp_update_post($update);
    add_action('save_post', 'qd_handle_save', 10, 2);
}

/** 게시 가능 조건 — 폼·REST 공용 검증. 에러 배열(비면 통과). */
function qd_validate(int $postId, string $type): array
{
    $errors = [];
    $meta = fn(string $k): string => (string) get_post_meta($postId, $k, true);

    foreach (qd_field_schema()[$type] as $key => $def) {
        if (!empty($def['required']) && $meta($key) === '') $errors[] = "{$def['label']}: 필수입니다";
    }

    if ($type === 'qd_question') {
        $options = json_decode($meta('qd_options'), true) ?: [];
        $answer  = json_decode($meta('qd_answer'), true) ?: [];
        $keys    = array_column($options, 'key');
        if (count($options) < 2) $errors[] = '보기는 2개 이상이어야 합니다';
        if (count($keys) !== count(array_unique($keys))) $errors[] = '보기 key 가 중복됩니다';
        foreach ($options as $o) {
            if (trim($o['text'] ?? '') === '') $errors[] = "보기 {$o['key']}: 텍스트가 비었습니다";
        }
        if (!$answer) $errors[] = '정답을 1개 이상 선택하세요';
        foreach ($answer as $a) {
            if (!in_array($a, $keys, true)) $errors[] = "정답 {$a} 가 보기에 없습니다";
        }
        $errors = array_merge($errors, qd_check_unique($postId, 'qd_question', 'qd_qn', $meta('qd_qn'), '문항 번호'));
    }

    if ($type === 'qd_concept') {
        $errors = array_merge($errors, qd_check_unique($postId, 'qd_concept', 'qd_svc', $meta('qd_svc'), '식별자(svc)'));
    }

    if ($type === 'qd_exam') {
        $key = $meta('qd_provider') !== '' && $meta('qd_slug') !== '' ? $meta('qd_provider') . '/' . $meta('qd_slug') : '';
        if ($key !== '') {
            update_post_meta($postId, 'qd_exam_key', $key);
            $errors = array_merge($errors, qd_check_unique($postId, 'qd_exam', 'qd_exam_key', $key, 'examKey', false));
        }
    }

    return $errors;
}

/** (문제집 스코프) 메타 유일성 — draft 포함 전수(status any). */
function qd_check_unique(int $postId, string $type, string $metaKey, string $value, string $label, bool $scopeExam = true): array
{
    if ($value === '') return [];
    $meta_query = [['key' => $metaKey, 'value' => $value]];
    if ($scopeExam) {
        $examId = (string) get_post_meta($postId, 'qd_exam_id', true);
        if ($examId === '') return [];
        $meta_query[] = ['key' => 'qd_exam_id', 'value' => $examId];
    }
    $dup = get_posts([
        'post_type'    => $type,
        'post_status'  => 'any',
        'exclude'      => [$postId],
        'numberposts'  => 1,
        'fields'       => 'ids',
        'meta_query'   => $meta_query,
    ]);
    return $dup ? ["{$label} '{$value}' 이(가) 이미 존재합니다 (#{$dup[0]})"] : [];
}

function qd_auto_title(int $postId, string $type): string
{
    $meta = fn(string $k): string => (string) get_post_meta($postId, $k, true);
    return match ($type) {
        'qd_question' => $meta('qd_qn') !== '' ? "Q{$meta('qd_qn')}" : '',
        'qd_concept'  => $meta('qd_svc'),
        'qd_exam'     => '', // 문제집 제목은 사용자가 직접(표시명)
        default       => '',
    };
}

// 검증 실패 알림 — draft 강등 사유를 편집 화면 상단에.
add_action('admin_notices', function () {
    $screen = get_current_screen();
    if (!$screen || !isset($_GET['post'])) return;
    $errors = get_transient('qd_errors_' . (int) $_GET['post']);
    if (!$errors) return;
    delete_transient('qd_errors_' . (int) $_GET['post']);
    echo '<div class="notice notice-error"><p><strong>게시할 수 없어 초안으로 저장됨:</strong></p><ul style="list-style:disc;margin-left:20px">';
    foreach ($errors as $e) echo '<li>' . esc_html($e) . '</li>';
    echo '</ul></div>';
});
