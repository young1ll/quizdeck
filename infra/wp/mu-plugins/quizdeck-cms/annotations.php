<?php
/**
 * 회원 주석 관리 (ADR-0027) — wp-admin 에서 학습 앱 회원의 주석(밑줄·형광펜·인라인 메모)을
 * 조회·수정(memo·kind)·삭제한다. 데이터 소유는 앱 postgres — WP 는 클러스터 내부 앱 API 를
 * 서버-서버 호출(X-QD-Token, revalidate 웹훅과 같은 결)만 하고 앱 DB 에 직접 붙지 않는다
 * (ADR-0025 경계). 조작자 감사는 X-QD-Actor 헤더(WP 로그인명)로 앱 로그에 남는다.
 * env(QD_ADMIN_API_URL·QD_ADMIN_API_TOKEN) 미설정(로컬 등)이면 화면이 안내만 한다.
 */

defined('ABSPATH') || exit;

// 우선순위 20 — 부모 add_menu_page('quizdeck-cms')는 admin.php(로드가 이 파일보다 뒤)의
// 기본 우선순위 콜백이 만든다. 부모보다 먼저 서브메뉴를 달면 접근 검사가 403 을 낸다.
add_action('admin_menu', function (): void {
    add_submenu_page('quizdeck-cms', '회원 주석 관리', '회원 주석', 'manage_options', 'qd-annotations', 'qd_anno_render');
}, 20);

/** env 계약 — ['url','token'] 또는 null(미설정 = 화면 안내·발사 안 함). */
function qd_anno_config(): ?array
{
    $url   = getenv('QD_ADMIN_API_URL');
    $token = getenv('QD_ADMIN_API_TOKEN');
    if (!$url || !$token) return null;
    return ['url' => rtrim($url, '/'), 'token' => $token];
}

/**
 * 앱 내부 API 호출 — [성공, 디코드된 body(성공)|에러 문구(실패)]. 뮤테이션 204 는 body 없음 → [].
 * blocking(관리 화면은 결과를 봐야 한다) — 웹훅(blocking=false)과 달리 대시보드 수동 발사와 같은 결.
 */
function qd_anno_api(string $method, string $path, ?array $body = null): array
{
    $cfg = qd_anno_config();
    if ($cfg === null) return [false, '연동 미설정 — QD_ADMIN_API_URL/QD_ADMIN_API_TOKEN env 부재'];
    $actor = wp_get_current_user()->user_login ?: 'unknown';
    $res = wp_remote_request($cfg['url'] . $path, [
        'method'  => $method,
        'timeout' => 5,
        'headers' => [
            'Content-Type' => 'application/json',
            'X-QD-Token'   => $cfg['token'],
            'X-QD-Actor'   => rawurlencode($actor), // HTTP 헤더는 ByteString — 한글 로그인명 안전 인코딩
        ],
        'body'    => $body === null ? null : wp_json_encode($body),
    ]);
    if (is_wp_error($res)) return [false, '앱 API 연결 실패 — ' . $res->get_error_message()];
    $code = wp_remote_retrieve_response_code($res);
    if ($code < 200 || $code >= 300) return [false, "앱 API 오류 — HTTP {$code}"];
    $decoded = json_decode(wp_remote_retrieve_body($res), true);
    return [true, is_array($decoded) ? $decoded : []];
}

/** exam_key(provider/slug) → "시험명 (key)" — qd_exam CPT 메타 조회, 미등록 키는 raw 반환. */
function qd_anno_exam_title(string $examKey): string
{
    static $cache = [];
    if (isset($cache[$examKey])) return $cache[$examKey];
    $posts = get_posts(['post_type' => 'qd_exam', 'post_status' => 'publish', 'numberposts' => 1,
        'meta_query' => [['key' => 'qd_exam_key', 'value' => $examKey]]]);
    return $cache[$examKey] = $posts ? "{$posts[0]->post_title} ({$examKey})" : $examKey;
}

/** annotation.field → 표시 라벨 ('q'|'explanation'|'tip'|'opt:A'…). */
function qd_anno_field_label(string $field): string
{
    $map = ['q' => '문제', 'explanation' => '해설', 'tip' => '팁'];
    if (isset($map[$field])) return $map[$field];
    return str_starts_with($field, 'opt:') ? '보기 ' . substr($field, 4) : $field;
}

// ── 뮤테이션 코어 — admin-post 핸들러와 분리(테스트 표면, 50-admin 의 헬퍼 단위 검증 결) ──

/** memo·kind 수정 — memo 빈 문자열은 메모 삭제(null 전송). [ok, 알림 문구]. */
function qd_anno_do_update(string $id, string $kind, string $memo): array
{
    [$ok, $r] = qd_anno_api('PATCH', '/annotations',
        ['id' => $id, 'memo' => $memo === '' ? null : $memo, 'kind' => $kind]);
    return $ok ? [true, '주석을 수정했습니다.'] : [false, is_string($r) ? $r : '수정 실패'];
}

/** id 기준 삭제. [ok, 알림 문구]. */
function qd_anno_do_delete(string $id): array
{
    [$ok, $r] = qd_anno_api('DELETE', '/annotations?id=' . rawurlencode($id));
    return $ok ? [true, '주석을 삭제했습니다.'] : [false, is_string($r) ? $r : '삭제 실패'];
}

// ── 액션(admin-post) — manage_options + 행 단위 nonce, 결과는 transient 알림(대시보드 패턴) ──
foreach (['qd_anno_update', 'qd_anno_delete'] as $qdAnnoAction) {
    add_action("admin_post_{$qdAnnoAction}", function () use ($qdAnnoAction): void {
        if (!current_user_can('manage_options')) wp_die('권한 없음');
        $id = sanitize_text_field(wp_unslash($_POST['anno_id'] ?? ''));
        check_admin_referer($qdAnnoAction . '_' . $id);
        [$ok, $msg] = $qdAnnoAction === 'qd_anno_update'
            ? qd_anno_do_update($id,
                sanitize_text_field(wp_unslash($_POST['kind'] ?? '')),
                sanitize_textarea_field(wp_unslash($_POST['memo'] ?? '')))
            : qd_anno_do_delete($id);
        set_transient('qd_anno_msg_' . get_current_user_id(), [$ok, $msg], 60);
        $learner = sanitize_text_field(wp_unslash($_POST['learner'] ?? ''));
        wp_safe_redirect(admin_url('admin.php?page=qd-annotations'
            . ($learner !== '' ? '&learner=' . rawurlencode($learner) : '')));
        exit;
    });
}

add_action('admin_notices', function (): void {
    $msg = get_transient('qd_anno_msg_' . get_current_user_id());
    if (!$msg) return;
    delete_transient('qd_anno_msg_' . get_current_user_id());
    printf('<div class="notice notice-%s"><p>%s</p></div>', $msg[0] ? 'success' : 'error', esc_html($msg[1]));
});

// ── 렌더 — ?learner=<id> 유무로 목록/상세 2단 ──
function qd_anno_render(): void
{
    $learner = sanitize_text_field(wp_unslash($_GET['learner'] ?? ''));
    echo '<div class="wrap">';
    if ($learner !== '') qd_anno_render_detail($learner);
    else qd_anno_render_list();
    echo '</div>';
}

/** 목록 — 회원 검색(이메일/이름, 빈 검색 = 주석 많은 순 상위 50) + 회원별 주석 요약. */
function qd_anno_render_list(): void
{
    echo '<h1>회원 주석 관리</h1>';
    if (qd_anno_config() === null) {
        echo '<p>⚠️ 연동 미설정 — <code>QD_ADMIN_API_URL</code>·<code>QD_ADMIN_API_TOKEN</code> env'
            . '(Secret <code>wp-admin-api</code>)를 설정하세요. 데이터는 학습 앱이 소유합니다 (ADR-0027).</p>';
        return;
    }
    $q = sanitize_text_field(wp_unslash($_GET['q'] ?? ''));
    ?>
    <form method="get" style="margin:12px 0">
      <input type="hidden" name="page" value="qd-annotations">
      <input type="search" name="q" value="<?php echo esc_attr($q); ?>" placeholder="이메일 또는 이름" class="regular-text">
      <button class="button">검색</button>
    </form>
    <?php
    [$ok, $learners] = qd_anno_api('GET', '/learners?q=' . rawurlencode($q));
    if (!$ok) {
        printf('<div class="notice notice-error"><p>%s</p></div>', esc_html($learners));
        return;
    }
    if (!$learners) {
        echo '<p>검색 결과가 없습니다.</p>';
        return;
    }
    ?>
    <table class="widefat striped" style="max-width:900px">
      <thead><tr><th>이름</th><th>이메일</th><th>인증</th><th>주석</th><th>최근 주석</th><th></th></tr></thead>
      <tbody>
      <?php foreach ($learners as $l) :
          $last = $l['lastAnnotatedAt'] ?? null;
          $url  = admin_url('admin.php?page=qd-annotations&learner=' . rawurlencode((string) $l['id'])); ?>
        <tr>
          <td><?php echo esc_html((string) $l['name']); ?></td>
          <td><?php echo esc_html((string) $l['email']); ?></td>
          <td><?php echo !empty($l['emailVerified']) ? '✅' : '—'; ?></td>
          <td><?php echo (int) $l['annotationCount']; ?></td>
          <td><?php echo $last === null ? '—' : esc_html(wp_date('Y-m-d H:i', intdiv((int) $last, 1000)) ?: '—'); ?></td>
          <td><a class="button button-small" href="<?php echo esc_url($url); ?>">주석 보기</a></td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
    <?php
}

/** 상세 — 회원 한 명의 주석을 시험별 그룹으로. 행별 수정(kind·memo)·삭제(confirm) 폼. */
function qd_anno_render_detail(string $learnerId): void
{
    $back = admin_url('admin.php?page=qd-annotations');
    [$ok, $data] = qd_anno_api('GET', '/annotations?learner=' . rawurlencode($learnerId));
    echo '<h1>회원 주석 <a class="page-title-action" href="' . esc_url($back) . '">‹ 회원 목록</a></h1>';
    if (!$ok) {
        printf('<div class="notice notice-error"><p>%s</p></div>', esc_html($data));
        return;
    }
    $learner     = $data['learner'];
    $annotations = $data['annotations'];
    printf('<p><strong>%s</strong> · %s%s · 주석 %d개</p>',
        esc_html((string) $learner['name']), esc_html((string) $learner['email']),
        empty($learner['emailVerified']) ? ' (미인증)' : '', count($annotations));
    if (!$annotations) {
        echo '<p>이 회원은 아직 주석을 남기지 않았습니다.</p>';
        return;
    }

    $postUrl = admin_url('admin-post.php');
    $currentExam = null;
    foreach ($annotations as $a) { // exam_key·qn 정렬 보장(API) — 경계에서 그룹 헤더/테이블 전환
        $examKey = (string) ($a['examKey'] ?? '');
        if ($examKey !== $currentExam) {
            if ($currentExam !== null) echo '</tbody></table>';
            $currentExam = $examKey;
            echo '<h2 style="margin-top:20px">' . esc_html(qd_anno_exam_title($examKey)) . '</h2>';
            echo '<table class="widefat striped"><thead><tr>'
                . '<th style="width:160px">문항</th><th>인용</th><th style="width:420px">수정</th><th style="width:80px">삭제</th>'
                . '</tr></thead><tbody>';
        }
        $id    = (string) $a['id'];
        $kind  = (string) $a['kind'];
        $memo  = (string) ($a['memo'] ?? '');
        $quote = (string) ($a['anchor']['quote'] ?? '');
        ?>
        <tr>
          <td style="white-space:nowrap">Q<?php echo (int) $a['qn']; ?> ·
            <?php echo esc_html(qd_anno_field_label((string) $a['field'])); ?> ·
            <?php echo esc_html((string) $a['lang']); ?></td>
          <td><?php echo esc_html(mb_strimwidth($quote, 0, 80, '…')); ?></td>
          <td>
            <form method="post" action="<?php echo esc_url($postUrl); ?>" style="display:flex;gap:6px;align-items:center">
              <input type="hidden" name="action" value="qd_anno_update">
              <input type="hidden" name="anno_id" value="<?php echo esc_attr($id); ?>">
              <input type="hidden" name="learner" value="<?php echo esc_attr($learnerId); ?>">
              <?php echo wp_nonce_field('qd_anno_update_' . $id, '_wpnonce', true, false); ?>
              <select name="kind">
                <option value="highlight" <?php selected($kind, 'highlight'); ?>>형광펜</option>
                <option value="underline" <?php selected($kind, 'underline'); ?>>밑줄</option>
              </select>
              <input type="text" name="memo" value="<?php echo esc_attr($memo); ?>"
                     placeholder="메모 (비우면 삭제)" style="flex:1">
              <button class="button">저장</button>
            </form>
          </td>
          <td>
            <form method="post" action="<?php echo esc_url($postUrl); ?>"
                  onsubmit="return confirm('이 주석을 삭제할까요?')">
              <input type="hidden" name="action" value="qd_anno_delete">
              <input type="hidden" name="anno_id" value="<?php echo esc_attr($id); ?>">
              <input type="hidden" name="learner" value="<?php echo esc_attr($learnerId); ?>">
              <?php echo wp_nonce_field('qd_anno_delete_' . $id, '_wpnonce', true, false); ?>
              <button class="button button-link-delete">삭제</button>
            </form>
          </td>
        </tr>
        <?php
    }
    echo '</tbody></table>';
}
