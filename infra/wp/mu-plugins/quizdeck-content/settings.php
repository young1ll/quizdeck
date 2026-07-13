<?php
/**
 * 사이트 설정 (4단계 — payload site-config Global 의 WP 이관). 태그라인·푸터·공지 배너를
 * WP 옵션으로 관리(설정 → QuizDeck)하고, 앱은 공개 REST(/wp-json/qd/v1/site-config)로 읽는다
 * (공지·태그라인은 어차피 공개 표면 데이터). 저장 시 앱 전체를 revalidate(scope=site 웹훅).
 */

defined('ABSPATH') || exit;

const QD_SITE_OPTIONS = [
    'qd_tagline'        => ['label' => '태그라인', 'type' => 'text', 'desc' => '홈 상단 한 줄 소개 — 비우면 기본 문구'],
    'qd_footer_text'    => ['label' => '푸터 문구', 'type' => 'text', 'desc' => '홈 하단 — 비우면 기본 문구'],
    'qd_notice_enabled' => ['label' => '공지 배너 표시', 'type' => 'checkbox', 'desc' => ''],
    'qd_notice_text'    => ['label' => '공지 내용', 'type' => 'text', 'desc' => ''],
    'qd_notice_tone'    => ['label' => '공지 톤', 'type' => 'select', 'options' => ['info' => '안내', 'warning' => '주의'], 'desc' => ''],
];

// ── 설정 페이지 (Settings API) ──
add_action('admin_menu', function () {
    add_options_page('QuizDeck 설정', 'QuizDeck', 'manage_options', 'qd-settings', 'qd_render_settings_page');
});

add_action('admin_init', function () {
    register_setting('qd_settings', 'qd_tagline', ['sanitize_callback' => 'sanitize_text_field']);
    register_setting('qd_settings', 'qd_footer_text', ['sanitize_callback' => 'sanitize_text_field']);
    register_setting('qd_settings', 'qd_notice_enabled', ['sanitize_callback' => fn($v) => $v ? '1' : '']);
    register_setting('qd_settings', 'qd_notice_text', ['sanitize_callback' => 'sanitize_text_field']);
    register_setting('qd_settings', 'qd_notice_tone', ['sanitize_callback' => fn($v) => $v === 'warning' ? 'warning' : 'info']);
});

function qd_render_settings_page(): void
{
    ?>
    <div class="wrap">
      <h1>QuizDeck 설정</h1>
      <p>저장하면 학습 앱(myquizdeck.com)에 즉시 반영됩니다.</p>
      <form method="post" action="options.php">
        <?php settings_fields('qd_settings'); ?>
        <table class="form-table">
          <?php foreach (QD_SITE_OPTIONS as $key => $def) :
              $value = get_option($key, ''); ?>
            <tr>
              <th scope="row"><label for="<?php echo esc_attr($key); ?>"><?php echo esc_html($def['label']); ?></label></th>
              <td>
                <?php if ($def['type'] === 'checkbox') : ?>
                  <input type="checkbox" id="<?php echo esc_attr($key); ?>" name="<?php echo esc_attr($key); ?>" value="1" <?php checked($value, '1'); ?>>
                <?php elseif ($def['type'] === 'select') : ?>
                  <select id="<?php echo esc_attr($key); ?>" name="<?php echo esc_attr($key); ?>">
                    <?php foreach ($def['options'] as $v => $label) : ?>
                      <option value="<?php echo esc_attr($v); ?>" <?php selected($value, $v); ?>><?php echo esc_html($label); ?></option>
                    <?php endforeach; ?>
                  </select>
                <?php else : ?>
                  <input type="text" class="regular-text" id="<?php echo esc_attr($key); ?>" name="<?php echo esc_attr($key); ?>" value="<?php echo esc_attr($value); ?>">
                <?php endif; ?>
                <?php if ($def['desc']) : ?><p class="description"><?php echo esc_html($def['desc']); ?></p><?php endif; ?>
              </td>
            </tr>
          <?php endforeach; ?>
        </table>
        <?php submit_button('저장'); ?>
      </form>
    </div>
    <?php
}

// ── 공개 REST — 앱 서빙 계약 ──
add_action('rest_api_init', function () {
    register_rest_route('qd/v1', '/site-config', [
        'methods'             => 'GET',
        'permission_callback' => '__return_true', // 공개 표면 데이터(태그라인·공지)
        'callback'            => fn() => [
            'tagline'    => (string) get_option('qd_tagline', ''),
            'footerText' => (string) get_option('qd_footer_text', ''),
            'notice'     => [
                'enabled' => get_option('qd_notice_enabled', '') === '1',
                'text'    => (string) get_option('qd_notice_text', ''),
                'tone'    => get_option('qd_notice_tone', 'info') === 'warning' ? 'warning' : 'info',
            ],
        ],
    ]);
});

// ── 저장 → 앱 전체 revalidate (scope=site 웹훅 — webhook.php 의 발사기 재사용) ──
foreach (array_keys(QD_SITE_OPTIONS) as $opt) {
    add_action("update_option_{$opt}", 'qd_fire_site_revalidate');
    add_action("add_option_{$opt}", 'qd_fire_site_revalidate');
}

function qd_fire_site_revalidate(): void
{
    $url   = getenv('QD_REVALIDATE_URL');
    $token = getenv('QD_REVALIDATE_TOKEN');
    if (!$url || !$token) return;
    static $fired = false; // 옵션 5개 일괄 저장 시 1회만
    if ($fired) return;
    $fired = true;
    wp_remote_post($url, [
        'timeout'  => 3,
        'blocking' => false,
        'headers'  => ['Content-Type' => 'application/json', 'X-QD-Token' => $token],
        'body'     => wp_json_encode(['scope' => 'site']),
    ]);
}
