<?php
/**
 * media 설정 페이지 — env 없이 쓰는 사용처를 위한 options 폴백 UI(일반화 (a)).
 * env 가 있으면 저장값은 무시된다(소스 단위 우선 — plugin.php qd_media_config).
 * 메뉴 부모는 필터 seam: 단독 사용 시 기본 '설정', QuizDeck 조합에서는 admin.php 가
 * 'quizdeck-cms' 로 바꾼다(모듈은 조합에 무의존). 문자열은 영어 소스 + qd-media 도메인.
 */

defined('ABSPATH') || exit;

/** 필드 라벨·설명 — const 는 __() 를 못 부르므로 함수. */
function qd_media_settings_labels(): array
{
    return [
        'endpoint' => [__('R2/S3 endpoint', 'qd-media'), 'https://<account>.r2.cloudflarestorage.com'],
        'bucket'   => [__('Bucket', 'qd-media'), ''],
        'key'      => [__('Access Key ID', 'qd-media'), ''],
        'secret'   => [__('Secret Access Key', 'qd-media'), __('Stored as plain text in the database — prefer env (QD_MEDIA_*) when possible', 'qd-media')],
        'base_url' => [__('Public media domain', 'qd-media'), __('e.g. https://media.example.com — the bucket\'s public (custom) domain', 'qd-media')],
    ];
}

add_action('admin_menu', function () {
    add_submenu_page(
        (string) apply_filters('qd_media_settings_parent', 'options-general.php'),
        __('Media R2 Offload', 'qd-media'), __('Media (R2)', 'qd-media'), 'manage_options',
        'qd-media-settings', 'qd_media_render_settings'
    );
}, 20); // 부모 메뉴(10) 이후

add_action('admin_init', function () {
    foreach (array_keys(qd_media_fields()) as $field) {
        register_setting('qd_media_settings', "qd_media_{$field}", ['sanitize_callback' => 'sanitize_text_field']);
    }
});

function qd_media_render_settings(): void
{
    $status = match (qd_media_config_source()) {
        'env'     => __('<strong>Environment variables (QD_MEDIA_*) take precedence</strong> — values saved below are ignored.', 'qd-media'),
        'options' => __('Active — using the values saved below.', 'qd-media'),
        default   => __('Not configured — uploads stay local only (non-durable on stateless hosts).', 'qd-media'),
    };
    ?>
    <div class="wrap">
      <h1><?php esc_html_e('Media R2 Offload', 'qd-media'); ?></h1>
      <p><?php echo wp_kses($status, ['strong' => []]); ?></p>
      <form method="post" action="options.php">
        <?php settings_fields('qd_media_settings'); ?>
        <table class="form-table">
          <?php foreach (qd_media_settings_labels() as $field => [$label, $desc]) :
              $optKey = "qd_media_{$field}"; ?>
            <tr>
              <th scope="row"><label for="<?php echo esc_attr($optKey); ?>"><?php echo esc_html($label); ?></label></th>
              <td>
                <input type="<?php echo $field === 'secret' ? 'password' : 'text'; ?>" class="regular-text"
                       id="<?php echo esc_attr($optKey); ?>" name="<?php echo esc_attr($optKey); ?>"
                       value="<?php echo esc_attr((string) get_option($optKey, '')); ?>"
                       <?php echo $field === 'secret' ? 'autocomplete="new-password"' : ''; ?>>
                <?php if ($desc) : ?><p class="description"><?php echo esc_html($desc); ?></p><?php endif; ?>
              </td>
            </tr>
          <?php endforeach; ?>
        </table>
        <?php submit_button(); ?>
      </form>
      <p class="description"><?php esc_html_e('Offloads originals only — intermediate sizes are disabled by default (qd_media_disable_sizes filter). See media/README.md for constraints.', 'qd-media'); ?></p>
    </div>
    <?php
}
