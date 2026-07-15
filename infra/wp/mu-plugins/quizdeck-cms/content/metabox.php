<?php
/**
 * 메타박스 렌더 — 스키마 필드는 qd_field_schema() 로 일괄, 특수 위젯 3종은 여기 전용:
 *   ① 문제집 select(관계) ② 보기 repeater(행 추가/삭제, key+text)
 *   ③ 정답 = 보기 key 체크박스(JS 동기화 — 보기를 고치면 체크박스가 따라온다)
 * 정답⊄보기가 UI 에서 구조적으로 불가능한 것이 ACF 대비 이 폼의 존재 이유다.
 */

defined('ABSPATH') || exit;

add_action('add_meta_boxes', function () {
    foreach (['qd_exam' => '문제집 정보', 'qd_question' => '문항 내용', 'qd_concept' => '개념 카드 내용', 'qd_service' => '서비스 정보', 'qd_diagram' => '다이어그램 내용'] as $type => $title) {
        add_meta_box("qd-{$type}", $title, 'qd_render_metabox', $type, 'normal', 'high');
    }
});

function qd_render_metabox(WP_Post $post): void
{
    wp_nonce_field('qd_save', 'qd_nonce');
    $schema = qd_field_schema()[$post->post_type] ?? [];

    echo '<style>
      .qd-field{margin:12px 0}.qd-field label{display:block;font-weight:600;margin-bottom:4px}
      .qd-field .desc{color:#666;font-size:12px;margin-top:2px}
      .qd-field input[type=text],.qd-field input[type=number],.qd-field textarea{width:100%}
      .qd-field textarea{min-height:70px}.qd-field textarea.qd-json{font-family:monospace;min-height:50px}
      table.qd-options{width:100%;border-collapse:collapse}table.qd-options td{padding:3px 6px 3px 0}
      table.qd-options .qd-opt-key{width:70px}#qd-answer-box label{display:inline-block;margin-right:14px;font-weight:600}
    </style>';

    // ── 관계: 문제집 select (문항·개념) ──
    if (in_array($post->post_type, ['qd_question', 'qd_concept', 'qd_diagram'], true)) {
        $examId = (int) get_post_meta($post->ID, 'qd_exam_id', true);
        $exams  = get_posts(['post_type' => 'qd_exam', 'numberposts' => -1, 'post_status' => ['publish', 'draft'], 'orderby' => 'title']);
        echo '<div class="qd-field"><label>문제집 *</label><select name="qd_exam_id" required><option value="">— 선택 —</option>';
        foreach ($exams as $e) {
            printf('<option value="%d" %s>%s</option>', $e->ID, selected($examId, $e->ID, false), esc_html($e->post_title));
        }
        echo '</select></div>';
    }

    // ── 스키마 필드 일괄 렌더 ──
    foreach ($schema as $key => $def) {
        $value = get_post_meta($post->ID, $key, true);
        if ($value === '' && isset($def['default'])) $value = $def['default'];
        $req = !empty($def['required']) ? ' *' : '';
        echo '<div class="qd-field"><label>' . esc_html($def['label'] . $req) . '</label>';
        if ($def['type'] === 'textarea' || $def['type'] === 'json') {
            printf('<textarea name="%s" class="%s">%s</textarea>', esc_attr($key), $def['type'] === 'json' ? 'qd-json' : '', esc_textarea($value));
        } elseif ($def['type'] === 'int') {
            printf('<input type="number" name="%s" value="%s">', esc_attr($key), esc_attr($value));
        } else {
            printf('<input type="text" name="%s" value="%s">', esc_attr($key), esc_attr($value));
        }
        if (!empty($def['desc'])) echo '<div class="desc">' . esc_html($def['desc']) . '</div>';
        echo '</div>';
    }

    // ── 문항 전용: 보기 repeater + 정답 체크박스 ──
    if ($post->post_type === 'qd_question') {
        $options = json_decode((string) get_post_meta($post->ID, 'qd_options', true), true) ?: [];
        $answer  = json_decode((string) get_post_meta($post->ID, 'qd_answer', true), true) ?: [];
        if (!$options) $options = [['key' => 'A', 'text' => ''], ['key' => 'B', 'text' => '']];

        echo '<div class="qd-field"><label>보기 *</label><table class="qd-options"><tbody id="qd-options-rows">';
        foreach ($options as $row) {
            qd_option_row_html($row['key'] ?? '', $row['text'] ?? '');
        }
        echo '</tbody></table><p><button type="button" class="button" id="qd-add-option">+ 보기 추가</button></p></div>';

        echo '<div class="qd-field"><label>정답 * <span class="desc" style="display:inline">— 보기 key 에서 체크(보기를 바꾸면 자동 갱신)</span></label><div id="qd-answer-box" data-answer="' . esc_attr(wp_json_encode(array_values($answer))) . '"></div></div>';

        qd_question_js();
    }
}

function qd_option_row_html(string $key, string $text): void
{
    printf(
        '<tr><td class="qd-opt-key"><input type="text" name="qd_opt_key[]" value="%s" placeholder="A"></td>' .
        '<td><textarea name="qd_opt_text[]" rows="2" style="width:100%%">%s</textarea></td>' .
        '<td style="width:30px"><button type="button" class="button-link-delete qd-del-option">✕</button></td></tr>',
        esc_attr($key),
        esc_textarea($text)
    );
}

function qd_question_js(): void
{
    ?>
    <script>
    (function () {
      const rows = document.getElementById('qd-options-rows');
      const answerBox = document.getElementById('qd-answer-box');
      let saved = new Set(JSON.parse(answerBox.dataset.answer || '[]'));

      function currentKeys() {
        return [...rows.querySelectorAll('input[name="qd_opt_key[]"]')].map(i => i.value.trim()).filter(Boolean);
      }
      function renderAnswers() {
        const checked = new Set([...answerBox.querySelectorAll('input:checked')].map(i => i.value));
        const keep = checked.size ? checked : saved;
        answerBox.innerHTML = '';
        currentKeys().forEach(k => {
          const id = 'qd-ans-' + k;
          const label = document.createElement('label');
          label.innerHTML = `<input type="checkbox" name="qd_answer[]" value="${k}" id="${id}" ${keep.has(k) ? 'checked' : ''}> ${k}`;
          answerBox.appendChild(label);
        });
      }
      rows.addEventListener('input', e => { if (e.target.name === 'qd_opt_key[]') renderAnswers(); });
      rows.addEventListener('click', e => {
        if (e.target.classList.contains('qd-del-option')) { e.target.closest('tr').remove(); renderAnswers(); }
      });
      document.getElementById('qd-add-option').addEventListener('click', () => {
        const keys = currentKeys();
        const next = keys.length ? String.fromCharCode(Math.max(...keys.map(k => k.charCodeAt(0))) + 1) : 'A';
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="qd-opt-key"><input type="text" name="qd_opt_key[]" value="${next}"></td>` +
          `<td><textarea name="qd_opt_text[]" rows="2" style="width:100%"></textarea></td>` +
          `<td style="width:30px"><button type="button" class="button-link-delete qd-del-option">✕</button></td>`;
        rows.appendChild(tr); renderAnswers();
      });
      renderAnswers();
    })();
    </script>
    <?php
}

// 목록 컬럼: 서비스 — 아이콘·provider·분류가 한눈에 (2026-07-15). 아이콘은 유효 아이콘
// (대표이미지 > qd_icon — REST 파생과 같은 우선순위)을 24px 로 렌더.
add_filter('manage_qd_service_posts_columns', function ($cols) {
    return array_slice($cols, 0, 2, true)
        + ['qd_svc_icon' => '아이콘', 'qd_provider' => 'provider', 'qd_cat' => '분류'] + $cols;
});
add_action('manage_qd_service_posts_custom_column', function ($col, $postId) {
    if ($col === 'qd_svc_icon') {
        $icon = get_the_post_thumbnail_url($postId, 'thumbnail')
            ?: (string) get_post_meta($postId, 'qd_icon', true);
        if ($icon === '') {
            echo '—';
        } elseif (preg_match('#^(https?://|/|data:image/)#', $icon)) {
            // data: URI 는 esc_url 이 프로토콜 화이트리스트로 제거한다 — esc_attr 로(자체 meta 값)
            printf('<img src="%s" style="width:24px;height:24px;object-fit:contain" alt="">', esc_attr($icon));
        } else {
            echo '<span style="font-size:20px">' . esc_html($icon) . '</span>'; // 이모지
        }
    }
    if ($col === 'qd_provider') echo esc_html((string) get_post_meta($postId, 'qd_provider', true) ?: '—');
    if ($col === 'qd_cat') echo esc_html((string) get_post_meta($postId, 'qd_cat', true) ?: '—');
}, 10, 2);
add_filter('manage_edit-qd_service_sortable_columns', fn($cols) => $cols + ['qd_provider' => 'qd_provider', 'qd_cat' => 'qd_cat']);
add_action('pre_get_posts', function (WP_Query $q): void {
    if (!is_admin() || !$q->is_main_query()) return;
    $orderby = $q->get('orderby');
    if (in_array($orderby, ['qd_provider', 'qd_cat'], true)) {
        $q->set('meta_key', $orderby);
        $q->set('orderby', 'meta_value');
    }
});

// 목록 컬럼: 문항 — 문제집·번호가 한눈에 (제목은 저장 시 자동 생성이라 보조 정보 노출이 중요)
add_filter('manage_qd_question_posts_columns', function ($cols) {
    return array_slice($cols, 0, 2, true) + ['qd_exam' => '문제집', 'qd_qn' => '번호'] + $cols;
});
add_action('manage_qd_question_posts_custom_column', function ($col, $postId) {
    if ($col === 'qd_exam') {
        $examId = (int) get_post_meta($postId, 'qd_exam_id', true);
        echo $examId ? esc_html(get_the_title($examId)) : '—';
    }
    if ($col === 'qd_qn') echo esc_html((string) get_post_meta($postId, 'qd_qn', true));
}, 10, 2);
