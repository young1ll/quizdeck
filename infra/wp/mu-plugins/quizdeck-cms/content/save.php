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
    if (count($update) > 1) {
        qd_demoting(true); // 자동 강등은 qn 셰도우를 해제하지 않는다(게이트 우회 방지)
        wp_update_post($update);
        qd_demoting(false);
    }
    add_action('save_post', 'qd_handle_save', 10, 2);
    if (!$errors && $post->post_status === 'publish' && $post->post_type === 'qd_question') {
        update_post_meta($postId, 'qd_qn_published', (string) get_post_meta($postId, 'qd_qn', true));
    }
}

/** 자동 강등 진행 중 플래그 — transition 훅이 사용자 초안 전환과 구분하는 데 쓴다. */
function qd_demoting(?bool $set = null): bool
{
    static $v = false;
    if ($set !== null) $v = $set;
    return $v;
}

// 사용자가 게시를 내리면(초안 전환·휴지통) qn 셰도우 해제 — 재게시 시점 qn 이 새 기준이 된다.
// 검증 실패로 인한 자동 강등(qd_demoting)은 제외: 게이트가 스스로를 우회하게 두지 않는다.
add_action('transition_post_status', function (string $new, string $old, WP_Post $post): void {
    if ($post->post_type !== 'qd_question' || $old !== 'publish' || $new === 'publish') return;
    if (qd_demoting()) return;
    delete_post_meta($post->ID, 'qd_qn_published');
    if ($new === 'trash') {
        set_transient('qd_trash_notice_' . get_current_user_id(),
            "Q" . get_post_meta($post->ID, 'qd_qn', true) . " 을(를) 휴지통으로 — 학습 기록(이력·오답·컬렉션·주석)이 이 문항을 참조합니다. 복원 전까지 학습자 화면에서 빠집니다", 60);
    }
}, 10, 3);

add_action('admin_notices', function (): void {
    $msg = get_transient('qd_trash_notice_' . get_current_user_id());
    if (!$msg) return;
    delete_transient('qd_trash_notice_' . get_current_user_id());
    echo '<div class="notice notice-warning"><p>' . esc_html($msg) . '</p></div>';
});

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
        // qn 불변 게이트 — 학습자 데이터(이력·오답·컬렉션·주석)가 (examKey, qn)으로 이 문항을
        // 참조한다. 셰도우(qd_qn_published = 마지막 게시 시점 qn)와 다르면 게시 거부. 탈출구는
        // 의도적 2단계: 사용자가 초안으로 전환(셰도우 해제 — 아래 transition 훅)→변경→재게시.
        $shadow = $meta('qd_qn_published');
        if ($shadow !== '' && $shadow !== $meta('qd_qn')) {
            $errors[] = "게시된 문항의 번호는 변경할 수 없습니다 — 학습 기록이 Q{$shadow} 를 참조합니다. "
                . "정말 필요하면 초안으로 전환한 뒤 변경해 재게시하세요";
        }
    }

    if ($type === 'qd_concept') {
        $errors = array_merge($errors, qd_check_unique($postId, 'qd_concept', 'qd_svc', $meta('qd_svc'), '식별자(svc)'));
        // 참조 서비스 존재 검증 — id 는 이 카드가 속한 시험의 provider 스코프로 조회(ADR-0026).
        $serviceIds = json_decode($meta('qd_service_ids'), true) ?: [];
        if ($serviceIds) {
            $examId   = (int) $meta('qd_exam_id');
            $provider = $examId ? (string) get_post_meta($examId, 'qd_provider', true) : '';
            foreach ($serviceIds as $sid) {
                if (!is_string($sid) || $provider === '' || !qd_find_service($provider, $sid)) {
                    $errors[] = "참조 서비스 '{$sid}' 이(가) 레지스트리에 없습니다 (provider: {$provider})";
                }
            }
        }
    }

    if ($type === 'qd_service') {
        $sid = $meta('qd_service_id');
        if ($sid !== '' && !preg_match('/^[a-z0-9-]+$/', $sid)) {
            $errors[] = '서비스 id: 소문자·숫자·하이픈만 허용합니다 (언어 무관 안정 키)';
        }
        // (provider, service_id) 유일성 — exam_key 와 같은 파생 복합키 패턴.
        $key = $meta('qd_provider') !== '' && $sid !== '' ? $meta('qd_provider') . '/' . $sid : '';
        if ($key !== '') {
            update_post_meta($postId, 'qd_service_key', $key);
            $errors = array_merge($errors, qd_check_unique($postId, 'qd_service', 'qd_service_key', $key, '서비스 키', false));
        }
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
        'qd_service'  => $meta('qd_name'),
        'qd_exam'     => '', // 문제집 제목은 사용자가 직접(표시명)
        default       => '',
    };
}

/** (provider, service_id) 로 서비스 조회 — 검증·파생 공용. */
function qd_find_service(string $provider, string $serviceId): ?int
{
    $found = get_posts([
        'post_type'   => 'qd_service',
        'post_status' => 'publish',
        'numberposts' => 1,
        'fields'      => 'ids',
        'meta_query'  => [['key' => 'qd_service_key', 'value' => "{$provider}/{$serviceId}"]],
    ]);
    return $found[0] ?? null;
}

// 파생 캐시(exam 아이콘 오버레이 — rest.php) 무효화: 콘텐츠 4종 저장 시 전부 비운다.
// 시험이 2~3개뿐이라 전량 무효화가 선택적 무효화보다 단순하고 충분히 싸다.
add_action('save_post', function (int $postId, WP_Post $post): void {
    if (!in_array($post->post_type, ['qd_exam', 'qd_question', 'qd_concept', 'qd_service'], true)) return;
    foreach (get_posts(['post_type' => 'qd_exam', 'post_status' => 'any', 'numberposts' => -1, 'fields' => 'ids']) as $eid) {
        delete_transient("qd_icons_{$eid}");
    }
}, 20, 2);

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
