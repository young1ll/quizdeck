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

    // ── 스키마 필드 일괄 렌더 (qd_svg·qd_icon 은 실시간 미리보기 부착 — 2026-07-15) ──
    foreach ($schema as $key => $def) {
        $value = get_post_meta($post->ID, $key, true);
        if ($value === '' && isset($def['default'])) $value = $def['default'];
        $req = !empty($def['required']) ? ' *' : '';
        echo '<div class="qd-field"><label>' . esc_html($def['label'] . $req) . '</label>';
        if ($def['type'] === 'textarea' || $def['type'] === 'json') {
            printf('<textarea name="%s" class="%s"%s>%s</textarea>', esc_attr($key), $def['type'] === 'json' ? 'qd-json' : '',
                $key === 'qd_svg' ? ' data-qd-svg-src' : '', esc_textarea($value));
        } elseif ($def['type'] === 'int') {
            printf('<input type="number" name="%s" value="%s">', esc_attr($key), esc_attr($value));
        } elseif ($key === 'qd_topic') {
            // 기존 주제 선택 or 새 주제 입력 — WP 표준 관례(부모 페이지 드롭다운 류): 기본 select
            // + '새 주제 직접 입력' 선택 시 텍스트 필드 노출. 옵션은 소속 시험 스코프(Topic 은
            // 시험 스코프 개념), 새 문항은 전 시험 합집합. 저장 정규화는 save.php(qd_topic_from_post).
            // 옵션 = provider 스코프(통일 체계 — 새 시험도 같은 목록에서 시작). 시험 미지정은 전역.
            $topics = qd_admin_topic_choices((int) get_post_meta($post->ID, 'qd_exam_id', true));
            if ($value !== '' && !in_array($value, $topics, true)) $topics[] = $value; // 현재값 보존
            echo '<select name="qd_topic" data-qd-topic-select>';
            echo '<option value="">— 없음 —</option>';
            foreach ($topics as $t) {
                printf('<option value="%s"%s>%s</option>', esc_attr($t), selected($value, $t, false), esc_html($t));
            }
            echo '<option value="__new__">+ 새 주제 직접 입력…</option>';
            echo '</select>';
            // 새 주제 입력 — select 아래 자체 줄(WP 카테고리 '새로 추가' 관례), 표시 시 자동 포커스,
            // 다른 선택으로 되돌아가면 값 비움(잔존값이 다음에 열릴 때 혼란 주지 않게 — 저장엔 어차피 무영향).
            echo '<div data-qd-topic-new-wrap style="display:none;margin-top:6px">';
            printf('<input type="text" name="qd_topic_new" class="regular-text" aria-label="새 주제 이름" data-qd-topic-new>');
            echo '<p class="description">이모지 + 이름 관례를 따르세요 (예: 📦 스토리지) — 저장하면 이 시험의 주제 목록에 추가됩니다.</p>';
            echo '</div>';
            ?>
            <script>
            (function () {
              const sel = document.querySelector('[data-qd-topic-select]');
              const wrap = document.querySelector('[data-qd-topic-new-wrap]');
              const txt = document.querySelector('[data-qd-topic-new]');
              if (!sel || !wrap || !txt) return;
              const sync = (focus) => {
                const isNew = sel.value === '__new__';
                wrap.style.display = isNew ? 'block' : 'none';
                if (isNew && focus) txt.focus();
                if (!isNew) txt.value = '';
              };
              sel.addEventListener('change', () => sync(true));
              sync(false);
            })();
            </script>
            <?php
        } else {
            printf('<input type="text" name="%s" value="%s"%s>', esc_attr($key), esc_attr($value),
                $key === 'qd_icon' ? ' data-qd-icon-src' : '');
        }
        if ($key === 'qd_icon') {
            // 아이콘 실시간 미리보기 — 목록 컬럼과 같은 유효 표시 규칙(이미지/데이터 URI = img, 그 외 텍스트)
            echo '<div class="desc" style="margin-top:6px">미리보기: <span data-qd-icon-preview style="display:inline-block;vertical-align:middle;min-width:28px"></span></div>';
        }
        if (!empty($def['desc'])) echo '<div class="desc">' . esc_html($def['desc']) . '</div>';
        echo '</div>';
    }

    // ── SVG 실시간 미리보기 (다이어그램) — 프론트 diagbox 와 같은 흰 배경 ──
    if (isset($schema['qd_svg'])) {
        echo '<div class="qd-field"><label>SVG 미리보기</label>'
            . '<div data-qd-svg-preview style="background:#fff;border:1px solid #dcdcde;border-radius:8px;padding:12px;overflow:auto;max-height:420px"></div>'
            . '<div class="desc">입력과 동시에 갱신 — 게시 시 앱 다이어그램 화면과 같은 마크업이 그대로 서빙됩니다</div></div>';
    }
    if (isset($schema['qd_svg']) || isset($schema['qd_icon'])) {
        qd_preview_js();
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

function qd_preview_js(): void
{
    ?>
    <script>
    (function () {
      // SVG 미리보기 — admin 이 자기 입력을 자기 화면에 렌더(저장 시 서빙되는 것과 동일 신뢰 수준)
      const svgSrc = document.querySelector('[data-qd-svg-src]');
      const svgBox = document.querySelector('[data-qd-svg-preview]');
      if (svgSrc && svgBox) {
        const renderSvg = () => {
          const v = svgSrc.value.trim();
          svgBox.innerHTML = v.includes('<svg') ? v : '<em style="color:#888">— SVG 마크업 없음(대표이미지 사용 시 비워둠) —</em>';
          svgBox.querySelectorAll('svg').forEach(el => { el.style.maxWidth = '100%'; el.style.height = 'auto'; });
        };
        svgSrc.addEventListener('input', renderSvg);
        renderSvg();
      }
      // 아이콘 미리보기 — 목록 컬럼과 같은 규칙(이미지 소스면 img, 아니면 텍스트)
      const iconSrc = document.querySelector('[data-qd-icon-src]');
      const iconBox = document.querySelector('[data-qd-icon-preview]');
      if (iconSrc && iconBox) {
        const renderIcon = () => {
          const v = iconSrc.value.trim();
          if (!v) { iconBox.textContent = '—'; return; }
          if (/^(https?:\/\/|\/|data:image\/)/.test(v)) {
            iconBox.innerHTML = '';
            const img = document.createElement('img');
            img.src = v; img.style.cssText = 'width:28px;height:28px;object-fit:contain';
            iconBox.appendChild(img);
          } else {
            iconBox.textContent = v;
            iconBox.style.fontSize = '22px';
          }
        };
        iconSrc.addEventListener('input', renderIcon);
        renderIcon();
      }
    })();
    </script>
    <?php
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

// ── 목록 컬럼 (2026-07-15 전 CPT 통일) — 각 유형의 식별·상태 정보를 목록에서 바로.
//    아이콘 셀은 유효 아이콘 규율(REST 파생과 동일 우선순위) 공유.

/** 아이콘 셀 렌더 — 이미지(URL·data URI)는 24px img, 이모지는 텍스트, 없으면 —.
 *  data: URI 는 esc_url 이 프로토콜 화이트리스트로 제거한다 — 자체 meta 값이라 esc_attr. */
function qd_admin_icon_cell(string $icon): void
{
    if ($icon === '') {
        echo '—';
    } elseif (preg_match('#^(https?://|/|data:image/)#', $icon)) {
        printf('<img src="%s" style="width:24px;height:24px;object-fit:contain" alt="">', esc_attr($icon));
    } else {
        echo '<span style="font-size:20px">' . esc_html($icon) . '</span>';
    }
}

/** 유효 아이콘 — 대표이미지 > qd_icon. 카드는 qd_icon > 첫 참조 서비스(파생과 동일). */
function qd_admin_effective_icon(int $postId): string
{
    if ($thumb = get_the_post_thumbnail_url($postId, 'thumbnail')) return $thumb;
    $own = (string) get_post_meta($postId, 'qd_icon', true);
    if ($own !== '' || get_post_type($postId) !== 'qd_concept') return $own;
    $sids = json_decode((string) get_post_meta($postId, 'qd_service_ids', true), true) ?: [];
    $examId = (int) get_post_meta($postId, 'qd_exam_id', true);
    $provider = $examId ? (string) get_post_meta($examId, 'qd_provider', true) : '';
    if (!$sids || !is_string($sids[0]) || $provider === '') return '';
    $svc = qd_find_service($provider, $sids[0]);
    return $svc ? (get_the_post_thumbnail_url($svc, 'thumbnail') ?: (string) get_post_meta($svc, 'qd_icon', true)) : '';
}

function qd_admin_exam_cell(int $postId): void
{
    $examId = (int) get_post_meta($postId, 'qd_exam_id', true);
    echo $examId ? esc_html(get_the_title($examId)) : '—';
}

add_filter('manage_qd_exam_posts_columns', fn($cols) => array_slice($cols, 0, 2, true)
    + ['qd_col_icon' => '아이콘', 'qd_provider' => 'provider', 'qd_code' => '코드', 'qd_col_qcount' => '문항 수'] + $cols);
add_action('manage_qd_exam_posts_custom_column', function ($col, $postId) {
    if ($col === 'qd_col_icon') qd_admin_icon_cell(qd_admin_effective_icon($postId));
    if ($col === 'qd_provider') echo esc_html((string) get_post_meta($postId, 'qd_provider', true) ?: '—');
    if ($col === 'qd_code') echo esc_html((string) get_post_meta($postId, 'qd_code', true) ?: '—');
    if ($col === 'qd_col_qcount') {
        echo count(get_posts(['post_type' => 'qd_question', 'post_status' => 'publish', 'numberposts' => -1,
            'fields' => 'ids', 'meta_query' => [['key' => 'qd_exam_id', 'value' => (string) $postId]]]));
    }
}, 10, 2);
add_filter('manage_edit-qd_exam_sortable_columns', fn($cols) => $cols + ['qd_provider' => 'qd_provider', 'qd_code' => 'qd_code']);

add_filter('manage_qd_question_posts_columns', fn($cols) => array_slice($cols, 0, 2, true)
    + ['qd_exam' => '문제집', 'qd_qn' => '번호', 'qd_topic' => '주제', 'qd_col_icon' => '이미지'] + $cols);
add_action('manage_qd_question_posts_custom_column', function ($col, $postId) {
    if ($col === 'qd_exam') qd_admin_exam_cell($postId);
    if ($col === 'qd_qn') echo esc_html((string) get_post_meta($postId, 'qd_qn', true));
    if ($col === 'qd_topic') echo esc_html((string) get_post_meta($postId, 'qd_topic', true) ?: '—');
    if ($col === 'qd_col_icon') qd_admin_icon_cell((string) get_the_post_thumbnail_url($postId, 'thumbnail'));
}, 10, 2);
add_filter('manage_edit-qd_question_sortable_columns', fn($cols) => $cols + ['qd_qn' => 'qd_qn']);

add_filter('manage_qd_concept_posts_columns', fn($cols) => array_slice($cols, 0, 2, true)
    + ['qd_col_icon' => '아이콘', 'qd_exam' => '문제집', 'qd_cat' => '분류', 'qd_col_services' => '참조 서비스'] + $cols);
add_action('manage_qd_concept_posts_custom_column', function ($col, $postId) {
    if ($col === 'qd_col_icon') qd_admin_icon_cell(qd_admin_effective_icon($postId));
    if ($col === 'qd_exam') qd_admin_exam_cell($postId);
    if ($col === 'qd_cat') echo esc_html((string) get_post_meta($postId, 'qd_cat', true) ?: '—');
    if ($col === 'qd_col_services') {
        $sids = json_decode((string) get_post_meta($postId, 'qd_service_ids', true), true) ?: [];
        echo $sids ? esc_html(implode(', ', $sids)) : '<span style="color:#b32d2e">미참조</span>';
    }
}, 10, 2);
add_filter('manage_edit-qd_concept_sortable_columns', fn($cols) => $cols + ['qd_cat' => 'qd_cat']);

add_filter('manage_qd_diagram_posts_columns', fn($cols) => array_slice($cols, 0, 2, true)
    + ['qd_exam' => '문제집', 'qd_cat' => '분류', 'qd_col_format' => '형식', 'qd_ord' => '순서'] + $cols);
add_action('manage_qd_diagram_posts_custom_column', function ($col, $postId) {
    if ($col === 'qd_exam') qd_admin_exam_cell($postId);
    if ($col === 'qd_cat') echo esc_html((string) get_post_meta($postId, 'qd_cat', true) ?: '—');
    if ($col === 'qd_col_format') {
        $hasSvg = str_contains((string) get_post_meta($postId, 'qd_svg', true), '<svg');
        $hasImg = has_post_thumbnail($postId);
        echo esc_html($hasSvg && $hasImg ? 'SVG+이미지' : ($hasImg ? '이미지' : 'SVG'));
    }
    if ($col === 'qd_ord') echo esc_html((string) get_post_meta($postId, 'qd_ord', true));
}, 10, 2);
add_filter('manage_edit-qd_diagram_sortable_columns', fn($cols) => $cols + ['qd_ord' => 'qd_ord', 'qd_cat' => 'qd_cat']);

// ── 순서 이동 (2026-07-16, 다이어그램·개념 카드) — 순서는 시스템 소유(fields.php 스키마 제외
//    참조). 목록 행 액션 ↑/↓ 가 시험 스코프 서열에서 인접 항목과 자리를 바꾼다. 이동 전 1..N
//    정규화가 레거시 중복/공백을 자가 치유한다(중복 ord 는 정렬 비결정이었다 — 도입 동기).

const QD_ORDERED_TYPES = ['qd_diagram', 'qd_concept'];

/** 시험 스코프 서열 이동 + 정규화. 경계(맨 위에서 ↑ 등)는 정규화만 하고 성공 반환. */
function qd_ord_move(int $postId, string $dir): bool
{
    $type = get_post_type($postId);
    if (!in_array($type, QD_ORDERED_TYPES, true)) return false;
    $eid = (int) get_post_meta($postId, 'qd_exam_id', true);
    if (!$eid) return false;
    $ids = get_posts(['post_type' => $type, 'post_status' => ['publish', 'draft', 'pending', 'future'],
        'numberposts' => -1, 'fields' => 'ids',
        'meta_query' => [['key' => 'qd_exam_id', 'value' => (string) $eid]]]);
    // 현 서열(ord 없음은 뒤, 동률은 ID)로 정렬 — meta_key 정렬은 ord 없는 글을 누락시켜 못 쓴다.
    usort($ids, function (int $a, int $b): int {
        $ord = fn(int $id): int => ($v = (string) get_post_meta($id, 'qd_ord', true)) === '' ? PHP_INT_MAX : (int) $v;
        return [$ord($a), $a] <=> [$ord($b), $b];
    });
    $i = array_search($postId, $ids, true);
    if ($i === false) return false;
    $j = $dir === 'down' ? $i + 1 : $i - 1;
    if ($j >= 0 && $j < count($ids)) [$ids[$i], $ids[$j]] = [$ids[$j], $ids[$i]];
    foreach ($ids as $k => $id) {
        if ((string) get_post_meta($id, 'qd_ord', true) !== (string) ($k + 1)) {
            update_post_meta($id, 'qd_ord', (string) ($k + 1));
        }
    }
    // update_post_meta 직행이라 save_post 훅이 안 돈다 — 서빙 파생 캐시·앱 revalidate 를 직접.
    // (개념 카드는 파생 트랜지언트 없음 — REST 가 매 요청 ord 정렬로 읽는다.)
    if ($type === 'qd_diagram') delete_transient("qd_diagrams_{$eid}");
    qd_fire_revalidate(get_post($postId));
    return true;
}

add_filter('post_row_actions', function (array $actions, WP_Post $post): array {
    if (!in_array($post->post_type, QD_ORDERED_TYPES, true) || !current_user_can('edit_post', $post->ID)) return $actions;
    foreach (['up' => '↑ 위로', 'down' => '↓ 아래로'] as $dir => $label) {
        $url = wp_nonce_url(admin_url("admin-post.php?action=qd_ord_move&post={$post->ID}&dir={$dir}"), "qd_ord_move_{$post->ID}");
        $actions["qd_move_{$dir}"] = '<a href="' . esc_url($url) . '">' . esc_html($label) . '</a>';
    }
    return $actions;
}, 10, 2);

add_action('admin_post_qd_ord_move', function (): void {
    $postId = (int) ($_GET['post'] ?? 0);
    if (!current_user_can('edit_post', $postId)) wp_die('권한 없음');
    check_admin_referer("qd_ord_move_{$postId}");
    qd_ord_move($postId, ($_GET['dir'] ?? '') === 'down' ? 'down' : 'up');
    wp_safe_redirect(wp_get_referer() ?: admin_url('edit.php?post_type=' . get_post_type($postId)));
    exit;
});

// 문제집 필터 하의 기본 정렬 = 순서 — ↑↓ 이동 결과가 목록에 그대로 보인다. 필터 없는 전체
// 목록은 시험이 섞여 ord 정렬이 무의미 + meta_key 정렬이 ord 없는 글(문제집 미지정 초안)을
// 숨기는 함정이 있어 기본값(날짜)을 유지한다.
add_action('pre_get_posts', function (WP_Query $q): void {
    if (!is_admin() || !$q->is_main_query()) return;
    if (!in_array($q->get('post_type'), QD_ORDERED_TYPES, true) || $q->get('orderby') !== '') return;
    if (empty($_GET['qd_f_exam'])) return;
    $q->set('meta_key', 'qd_ord');
    $q->set('orderby', 'meta_value_num');
    $q->set('order', 'ASC');
});

add_filter('manage_qd_service_posts_columns', fn($cols) => array_slice($cols, 0, 2, true)
    + ['qd_col_icon' => '아이콘', 'qd_provider' => 'provider', 'qd_cat' => '분류'] + $cols);
add_action('manage_qd_service_posts_custom_column', function ($col, $postId) {
    if ($col === 'qd_col_icon') qd_admin_icon_cell(qd_admin_effective_icon($postId));
    if ($col === 'qd_provider') echo esc_html((string) get_post_meta($postId, 'qd_provider', true) ?: '—');
    if ($col === 'qd_cat') echo esc_html((string) get_post_meta($postId, 'qd_cat', true) ?: '—');
}, 10, 2);
add_filter('manage_edit-qd_service_sortable_columns', fn($cols) => $cols + ['qd_provider' => 'qd_provider', 'qd_cat' => 'qd_cat']);

// ── 목록 필터 (2026-07-15) — 유형별 드롭다운. 쿼리 적용은 순수 함수(테스트 표면)로 분리.

/** 유형별 distinct meta 값 — 필터·datalist 옵션 소스(초안 포함 — 강등된 글도 찾아야 한다).
 *  $examId 지정 시 그 시험 소속으로 스코프(주제는 시험 스코프 개념 — CONTEXT.md Topic). */
function qd_admin_distinct_meta(string $postType, string $metaKey, int $examId = 0): array
{
    global $wpdb;
    $scope = $examId ? $wpdb->prepare(
        " AND EXISTS (SELECT 1 FROM {$wpdb->postmeta} pe WHERE pe.post_id = p.ID
            AND pe.meta_key = 'qd_exam_id' AND pe.meta_value = %s)", (string) $examId) : '';
    return $wpdb->get_col($wpdb->prepare(
        "SELECT DISTINCT pm.meta_value FROM {$wpdb->postmeta} pm
         JOIN {$wpdb->posts} p ON p.ID = pm.post_id
         WHERE p.post_type = %s AND p.post_status IN ('publish','draft')
           AND pm.meta_key = %s AND pm.meta_value <> ''",
        $postType, $metaKey
    ) . $scope . ' ORDER BY pm.meta_value');
}

/** GET 파라미터 → meta_query 조각 (순수 — 훅과 테스트가 공유). */
function qd_admin_filter_meta_query(array $get): array
{
    $meta = [];
    $g = fn(string $k): string => isset($get[$k]) ? sanitize_text_field((string) wp_unslash($get[$k])) : '';
    if (($v = $g('qd_f_provider')) !== '') $meta[] = ['key' => 'qd_provider', 'value' => $v];
    if (($v = $g('qd_f_exam')) !== '')     $meta[] = ['key' => 'qd_exam_id', 'value' => (string) (int) $v];
    if (($v = $g('qd_f_topic')) !== '')    $meta[] = ['key' => 'qd_topic', 'value' => $v];
    if (($v = $g('qd_f_cat')) !== '')      $meta[] = ['key' => 'qd_cat', 'value' => $v];
    $ref = $g('qd_f_ref');
    if ($ref === 'ref') {
        $meta[] = ['key' => 'qd_service_ids', 'value' => '[]', 'compare' => '!='];
    } elseif ($ref === 'unref') {
        $meta[] = ['relation' => 'OR',
            ['key' => 'qd_service_ids', 'compare' => 'NOT EXISTS'],
            ['key' => 'qd_service_ids', 'value' => '[]']];
    }
    $fmt = $g('qd_f_format');
    if ($fmt === 'image') $meta[] = ['key' => '_thumbnail_id', 'compare' => 'EXISTS'];
    elseif ($fmt === 'svg') $meta[] = ['key' => 'qd_svg', 'compare' => 'EXISTS'];
    return $meta;
}

/** 주제 필터 옵션 — 평면 전역 목록(시험 구분 없음 — 라벨 체계 provider 통일, 2026-07-15 확정). */
function qd_admin_topic_options(int $examId): array
{
    $v = qd_admin_distinct_meta('qd_question', 'qd_topic');
    return array_combine($v, $v) ?: [];
}

/** 편집 화면 주제 선택지 — 소속 시험의 provider 에 속한 전 시험의 주제(통일 체계). */
function qd_admin_topic_choices(int $examId): array
{
    if (!$examId) return qd_admin_distinct_meta('qd_question', 'qd_topic');
    $provider = (string) get_post_meta($examId, 'qd_provider', true);
    $topics = [];
    foreach (get_posts(['post_type' => 'qd_exam', 'post_status' => ['publish', 'draft'], 'numberposts' => -1, 'fields' => 'ids',
        'meta_query' => [['key' => 'qd_provider', 'value' => $provider]]]) as $eid) {
        $topics = array_merge($topics, qd_admin_distinct_meta('qd_question', 'qd_topic', (int) $eid));
    }
    $topics = array_values(array_unique($topics));
    sort($topics);
    return $topics;
}

add_action('restrict_manage_posts', function (string $postType): void {
    $examOptions = function (): array {
        $out = [];
        foreach (get_posts(['post_type' => 'qd_exam', 'post_status' => ['publish', 'draft'], 'numberposts' => -1, 'orderby' => 'title']) as $e) {
            $out[(string) $e->ID] = $e->post_title;
        }
        return $out;
    };
    $defs = match ($postType) {
        'qd_exam'     => ['qd_f_provider' => ['provider 전체', array_combine($v = qd_admin_distinct_meta('qd_exam', 'qd_provider'), $v)]],
        'qd_question' => ['qd_f_exam' => ['문제집 전체', $examOptions()],
                          'qd_f_topic' => ['주제 전체', qd_admin_topic_options((int) ($_GET['qd_f_exam'] ?? 0))]],
        'qd_concept'  => ['qd_f_exam' => ['문제집 전체', $examOptions()],
                          'qd_f_cat' => ['분류 전체', array_combine($v = qd_admin_distinct_meta('qd_concept', 'qd_cat'), $v)],
                          'qd_f_ref' => ['참조 상태 전체', ['ref' => '서비스 참조됨', 'unref' => '미참조(편집 큐)']]],
        'qd_diagram'  => ['qd_f_exam' => ['문제집 전체', $examOptions()],
                          'qd_f_cat' => ['분류 전체', array_combine($v = qd_admin_distinct_meta('qd_diagram', 'qd_cat'), $v)],
                          'qd_f_format' => ['형식 전체', ['svg' => 'SVG', 'image' => '이미지']]],
        'qd_service'  => ['qd_f_provider' => ['provider 전체', array_combine($v = qd_admin_distinct_meta('qd_service', 'qd_provider'), $v)],
                          'qd_f_cat' => ['분류 전체', array_combine($v = qd_admin_distinct_meta('qd_service', 'qd_cat'), $v)]],
        default       => [],
    };
    foreach ($defs as $param => [$placeholder, $options]) {
        $current = isset($_GET[$param]) ? sanitize_text_field((string) wp_unslash($_GET[$param])) : '';
        echo '<select name="' . esc_attr($param) . '">';
        echo '<option value="">' . esc_html($placeholder) . '</option>';
        foreach ((array) $options as $value => $label) {
            if (is_array($label)) { // optgroup — 시험별 주제 구분(전체 보기에서 체계 섞임 방지)
                echo '<optgroup label="' . esc_attr((string) $value) . '">';
                foreach ($label as $v2 => $l2) {
                    printf('<option value="%s"%s>%s</option>', esc_attr((string) $v2), selected($current, (string) $v2, false), esc_html((string) $l2));
                }
                echo '</optgroup>';
                continue;
            }
            printf('<option value="%s"%s>%s</option>', esc_attr((string) $value), selected($current, (string) $value, false), esc_html((string) $label));
        }
        echo '</select>';
    }
});

add_action('pre_get_posts', function (WP_Query $q): void {
    if (!is_admin() || !$q->is_main_query()) return;
    if (!in_array($q->get('post_type'), ['qd_exam', 'qd_question', 'qd_concept', 'qd_diagram', 'qd_service'], true)) return;
    $extra = qd_admin_filter_meta_query($_GET);
    if ($extra) $q->set('meta_query', array_merge((array) ($q->get('meta_query') ?: []), $extra));
});

// meta 정렬 실행 — 텍스트/숫자 구분
add_action('pre_get_posts', function (WP_Query $q): void {
    if (!is_admin() || !$q->is_main_query()) return;
    $orderby = $q->get('orderby');
    $text = ['qd_provider', 'qd_cat', 'qd_code'];
    $num  = ['qd_qn', 'qd_ord'];
    if (in_array($orderby, $text, true)) { $q->set('meta_key', $orderby); $q->set('orderby', 'meta_value'); }
    if (in_array($orderby, $num, true))  { $q->set('meta_key', $orderby); $q->set('orderby', 'meta_value_num'); }
});
