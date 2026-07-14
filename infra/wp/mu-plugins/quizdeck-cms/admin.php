<?php
/**
 * admin 대시보드 — 모듈 조합 계층(모듈은 admin 에 무의존, admin 은 모듈을 읽는다).
 * 경계(사용자 확정 2026-07-14): 자격증명·서빙 계약은 env(Secret)가 소유 — admin 은
 * "보고(정보·상태), 점검하고(R2 연결 테스트), 실행(수동 revalidate·캐시 비우기)"만 한다.
 * 값 표시는 비밀 아닌 것만(버킷·호스트·URL), 키·토큰은 설정 여부만.
 */

defined('ABSPATH') || exit;

// ── 메뉴: 최상위 QuizDeck 단일 트리(재구성 2026-07-14) — CPT 4종은 cpt.php 의
//    show_in_menu='quizdeck-cms' 로, 미디어(R2) 설정은 부모 필터로 이 아래에 합류한다.
add_action('admin_menu', function () {
    add_menu_page('QuizDeck CMS', 'QuizDeck', 'manage_options', 'quizdeck-cms', 'qd_render_dashboard', 'dashicons-welcome-learn-more', 59);
    add_submenu_page('quizdeck-cms', 'QuizDeck 대시보드', '대시보드', 'manage_options', 'quizdeck-cms', 'qd_render_dashboard');
    add_submenu_page('quizdeck-cms', 'QuizDeck 사이트 설정', '사이트 설정', 'manage_options', 'qd-settings', 'qd_render_settings_page');
});

add_filter('qd_media_settings_parent', fn(): string => 'quizdeck-cms');

// 서브메뉴 순서 고정 — CPT 항목은 core 가 먼저 append 하므로 그대로 두면 대시보드가
// 첫 항목이 아니게 된다(부모 클릭 진입점이 흔들림). 명시 순서로 재배열.
add_action('admin_menu', function (): void {
    global $submenu;
    if (empty($submenu['quizdeck-cms'])) return;
    $order = ['quizdeck-cms', 'edit.php?post_type=qd_exam', 'edit.php?post_type=qd_question',
              'edit.php?post_type=qd_concept', 'edit.php?post_type=qd_diagram', 'edit.php?post_type=qd_service', 'qd-media-settings', 'qd-settings'];
    $rank = function (array $item) use ($order): int {
        $i = array_search($item[2], $order, true);
        return $i === false ? 99 : $i; // ?: 는 인덱스 0(대시보드)을 삼킨다 — 명시 비교
    };
    usort($submenu['quizdeck-cms'], fn(array $a, array $b): int => $rank($a) <=> $rank($b));
}, 999);

/** 플러그인 버전 — 로더 헤더가 단일 소스. */
function qd_plugin_version(): string
{
    $data = get_file_data(WPMU_PLUGIN_DIR . '/quizdeck-cms-loader.php', ['Version' => 'Version']);
    return $data['Version'] ?: '?';
}

/** 콘텐츠·레지스트리 상태 집계 — 렌더와 분리(테스트 표면). */
function qd_dashboard_stats(): array
{
    $counts = [];
    foreach (['qd_exam' => '문제집', 'qd_question' => '문항', 'qd_concept' => '개념 카드', 'qd_diagram' => '다이어그램', 'qd_service' => '서비스'] as $type => $label) {
        $c = wp_count_posts($type);
        $counts[$type] = ['label' => $label, 'publish' => (int) $c->publish, 'draft' => (int) $c->draft];
    }

    // 레지스트리 커버리지 — 서비스 미참조 카드는 admin 의 편집 작업 큐다
    $unlinked = [];
    $cards = get_posts(['post_type' => 'qd_concept', 'post_status' => 'publish', 'numberposts' => -1, 'fields' => 'ids']);
    foreach ($cards as $cid) {
        $sids = json_decode((string) get_post_meta($cid, 'qd_service_ids', true), true) ?: [];
        if (!$sids) $unlinked[] = ['id' => $cid, 'svc' => (string) get_post_meta($cid, 'qd_svc', true)];
    }

    // q2svc 미연결 문항 — 서비스맵에서 빠지는 문항(시험별)
    $unmapped = [];
    foreach (get_posts(['post_type' => 'qd_exam', 'post_status' => 'publish', 'numberposts' => -1]) as $exam) {
        $mapped = array_keys(json_decode((string) get_post_meta($exam->ID, 'qd_q2svc', true), true) ?: []);
        $qns = [];
        foreach (get_posts(['post_type' => 'qd_question', 'post_status' => 'publish', 'numberposts' => -1, 'fields' => 'ids',
            'meta_query' => [['key' => 'qd_exam_id', 'value' => (string) $exam->ID]]]) as $qid) {
            $qns[] = (int) get_post_meta($qid, 'qd_qn', true);
        }
        $miss = array_values(array_diff($qns, array_map('intval', $mapped)));
        sort($miss);
        $unmapped[(string) get_post_meta($exam->ID, 'qd_exam_key', true)] = $miss;
    }

    return ['counts' => $counts, 'cards_total' => count($cards), 'unlinked' => $unlinked, 'unmapped' => $unmapped];
}

/** R2 연결 왕복 점검 — 1바이트 PUT + DELETE. [성공 여부, 상세 문구]. */
function qd_dashboard_r2_test(): array
{
    $cfg = qd_media_config();
    if (!$cfg) return [false, 'R2 미설정(QD_MEDIA_* env 부재) — 업로드는 로컬(비영속)로 동작 중'];
    $tmp = tempnam(get_temp_dir(), 'qd-r2-'); // wp_tempnam 은 admin 전용 — CLI(테스트)에서도 안전하게
    file_put_contents($tmp, 'ok');
    $key = '.qd-healthcheck-' . wp_generate_password(8, false);
    $put = qd_media_r2_put($cfg, $key, $tmp, 'text/plain');
    $del = $put ? qd_media_r2_delete($cfg, $key) : false;
    unlink($tmp);
    if ($put && $del) return [true, "R2 왕복 정상 (PUT·DELETE — 버킷 {$cfg['bucket']})"];
    return [false, $put ? 'PUT 성공 후 DELETE 실패 — 고아 객체: ' . $key : 'PUT 실패 — error log 확인'];
}

/** 수동 revalidate — 전 시험 examKey + scope=site 를 블로킹 발사(응답 코드 수집). */
function qd_dashboard_revalidate_all(): array
{
    $url   = getenv('QD_REVALIDATE_URL');
    $token = getenv('QD_REVALIDATE_TOKEN');
    if (!$url || !$token) return [false, '웹훅 미설정(QD_REVALIDATE_* env 부재)'];

    $targets = [];
    foreach (get_posts(['post_type' => 'qd_exam', 'post_status' => 'publish', 'numberposts' => -1]) as $exam) {
        $key = (string) get_post_meta($exam->ID, 'qd_exam_key', true);
        if ($key !== '') $targets[$key] = ['examKey' => $key];
    }
    $targets['site'] = ['scope' => 'site'];

    $out = [];
    $allOk = true;
    foreach ($targets as $name => $body) {
        $res = wp_remote_post($url, [
            'timeout' => 5,
            'headers' => ['Content-Type' => 'application/json', 'X-QD-Token' => $token],
            'body'    => wp_json_encode($body),
        ]);
        $code = is_wp_error($res) ? $res->get_error_message() : wp_remote_retrieve_response_code($res);
        if ($code !== 200) $allOk = false;
        $out[] = "{$name}: {$code}";
    }
    return [$allOk, 'revalidate 발사 — ' . implode(' · ', $out)];
}

// ── 액션(admin-post) — manage_options + nonce, 결과는 transient 로 되돌려 알림 ──
foreach (['qd_r2_test', 'qd_revalidate_all', 'qd_flush_cache'] as $action) {
    add_action("admin_post_{$action}", function () use ($action) {
        if (!current_user_can('manage_options')) wp_die('권한 없음');
        check_admin_referer($action);
        [$ok, $msg] = match ($action) {
            'qd_r2_test'        => qd_dashboard_r2_test(),
            'qd_revalidate_all' => qd_dashboard_revalidate_all(),
            'qd_flush_cache'    => (function (): array {
                $n = 0;
                foreach (get_posts(['post_type' => 'qd_exam', 'post_status' => 'any', 'numberposts' => -1, 'fields' => 'ids']) as $eid) {
                    if (delete_transient("qd_icons_{$eid}")) $n++;
                }
                return [true, "파생 캐시 비움 ({$n}건) — 다음 요청에서 재계산"];
            })(),
        };
        set_transient('qd_dash_msg_' . get_current_user_id(), [$ok, $msg], 60);
        wp_safe_redirect(admin_url('admin.php?page=quizdeck-cms'));
        exit;
    });
}

add_action('admin_notices', function (): void {
    $msg = get_transient('qd_dash_msg_' . get_current_user_id());
    if (!$msg) return;
    delete_transient('qd_dash_msg_' . get_current_user_id());
    printf('<div class="notice notice-%s"><p>%s</p></div>', $msg[0] ? 'success' : 'error', esc_html($msg[1]));
});

// ── 렌더 ──
function qd_render_dashboard(): void
{
    $stats = qd_dashboard_stats();
    $media = qd_media_config();
    $webhookUrl = getenv('QD_REVALIDATE_URL');
    $hasToken   = (bool) getenv('QD_REVALIDATE_TOKEN');

    $btn = function (string $action, string $label): string {
        $url = admin_url('admin-post.php');
        return '<form method="post" action="' . esc_url($url) . '" style="display:inline-block;margin-right:6px">'
            . '<input type="hidden" name="action" value="' . esc_attr($action) . '">'
            . wp_nonce_field($action, '_wpnonce', true, false)
            . '<button class="button">' . esc_html($label) . '</button></form>';
    };
    ?>
    <div class="wrap">
      <h1>QuizDeck CMS <span style="font-size:14px;color:#666">v<?php echo esc_html(qd_plugin_version()); ?></span></h1>
      <p>headless CMS 운영 대시보드 — 자격증명·서빙 계약은 env(Secret)가 소유하며 여기서는 상태 확인과 운영 액션만 합니다 (ADR-0025/0026).</p>

      <h2>모듈</h2>
      <table class="widefat striped" style="max-width:760px">
        <tbody>
          <tr><td><strong>content</strong></td><td>CPT 4종 · 검증 게이트 · REST · 웹훅 · 사이트 설정</td>
              <td><?php echo function_exists('qd_field_schema') ? '✅ 로드됨' : '❌'; ?></td></tr>
          <tr><td><strong>media</strong></td><td>업로드 R2 offload</td>
              <td><?php echo function_exists('qd_media_config') ? '✅ 로드됨' : '❌'; ?></td></tr>
          <tr><td><strong>locale</strong></td><td>사이트 언어 ko_KR 고정</td>
              <td><?php echo has_filter('pre_option_WPLANG') ? '✅ 로드됨' : '❌'; ?></td></tr>
        </tbody>
      </table>

      <h2>연동 상태</h2>
      <table class="widefat striped" style="max-width:760px">
        <tbody>
          <tr>
            <td><strong>R2 미디어 offload</strong></td>
            <td><?php echo $media
                ? '✅ 설정됨(' . (qd_media_config_source() === 'env' ? 'env — Secret 소유' : 'admin 설정') . ') — 버킷 <code>' . esc_html($media['bucket']) . '</code> · 공개 도메인 <code>' . esc_html($media['base_url']) . '</code>'
                : '⚠️ 미설정 — 업로드는 로컬(pod 재시작 시 소실)'; ?></td>
            <td><?php echo $btn('qd_r2_test', 'R2 연결 테스트'); ?></td>
          </tr>
          <tr>
            <td><strong>revalidate 웹훅</strong></td>
            <td><?php echo $webhookUrl
                ? '✅ 설정됨 — <code>' . esc_html($webhookUrl) . '</code>' . ($hasToken ? ' (토큰 설정됨)' : ' · ❌ 토큰 없음')
                : '⚠️ 미설정 — 편집이 앱에 최대 1시간(ISR) 지연 반영'; ?></td>
            <td><?php echo $btn('qd_revalidate_all', '전체 revalidate 발사'); ?></td>
          </tr>
          <tr>
            <td><strong>파생 캐시</strong></td>
            <td>시험 아이콘 오버레이(transient — 콘텐츠 저장 시 자동 무효화)</td>
            <td><?php echo $btn('qd_flush_cache', '캐시 비우기'); ?></td>
          </tr>
        </tbody>
      </table>

      <h2>콘텐츠</h2>
      <table class="widefat striped" style="max-width:760px">
        <thead><tr><th>유형</th><th>게시</th><th>초안</th></tr></thead>
        <tbody>
        <?php foreach ($stats['counts'] as $c) : ?>
          <tr><td><?php echo esc_html($c['label']); ?></td><td><?php echo (int) $c['publish']; ?></td>
              <td><?php echo $c['draft'] ? '<strong style="color:#b32d2e">' . (int) $c['draft'] . '</strong> (게이트 강등 여부 확인)' : '0'; ?></td></tr>
        <?php endforeach; ?>
        </tbody>
      </table>

      <h2>편집 작업 큐</h2>
      <p><strong>서비스 미참조 카드 <?php echo count($stats['unlinked']); ?> / <?php echo (int) $stats['cards_total']; ?></strong>
         — 참조를 달면 서비스 아이콘이 자동 적용됩니다 (비교·전략 카드는 여러 개/0개도 정당).</p>
      <?php if ($stats['unlinked']) : ?>
        <ul style="columns:3;max-width:760px">
        <?php foreach ($stats['unlinked'] as $u) : ?>
          <li><a href="<?php echo esc_url(get_edit_post_link($u['id'])); ?>"><?php echo esc_html($u['svc']); ?></a></li>
        <?php endforeach; ?>
        </ul>
      <?php endif; ?>
      <?php foreach ($stats['unmapped'] as $examKey => $qns) : if (!$qns) continue; ?>
        <p><strong><?php echo esc_html($examKey); ?> — 서비스맵 미연결 문항 <?php echo count($qns); ?>개</strong>:
           Q<?php echo esc_html(implode(', Q', array_slice($qns, 0, 20))); echo count($qns) > 20 ? ' …' : ''; ?>
           (문제집의 q2svc 에 항목 추가)</p>
      <?php endforeach; ?>
    </div>
    <?php
}
