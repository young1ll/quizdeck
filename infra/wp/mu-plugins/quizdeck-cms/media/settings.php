<?php
/**
 * media 설정 페이지 — env 없이 쓰는 사용처를 위한 options 폴백 UI(일반화 (a)).
 * env 가 있으면 저장값은 무시된다(소스 단위 우선 — plugin.php qd_media_config).
 * 메뉴 부모는 필터 seam: 단독 사용 시 기본 '설정', QuizDeck 조합에서는 admin.php 가
 * 'quizdeck-cms' 로 바꾼다(모듈은 조합에 무의존).
 */

defined('ABSPATH') || exit;

const QD_MEDIA_SETTINGS_LABELS = [
    'endpoint' => ['R2/S3 엔드포인트', 'https://<account>.r2.cloudflarestorage.com'],
    'bucket'   => ['버킷', ''],
    'key'      => ['Access Key ID', ''],
    'secret'   => ['Secret Access Key', '⚠️ DB(options)에 평문 저장 — 가능하면 env(QD_MEDIA_*) 권장'],
    'base_url' => ['공개 미디어 도메인', '예: https://media.example.com — 버킷의 커스텀 도메인'],
];

add_action('admin_menu', function () {
    add_submenu_page(
        (string) apply_filters('qd_media_settings_parent', 'options-general.php'),
        '미디어 R2 offload', '미디어(R2)', 'manage_options', 'qd-media-settings', 'qd_media_render_settings'
    );
}, 20); // 부모 메뉴(10) 이후

add_action('admin_init', function () {
    foreach (array_keys(qd_media_fields()) as $field) {
        register_setting('qd_media_settings', "qd_media_{$field}", ['sanitize_callback' => 'sanitize_text_field']);
    }
});

function qd_media_render_settings(): void
{
    $source = qd_media_config_source();
    $status = match ($source) {
        'env'     => '✅ <strong>환경변수(QD_MEDIA_*)가 우선 적용 중</strong> — 아래 저장값은 무시됩니다 (QuizDeck 프로덕션의 정상 상태: 자격증명은 Secret 소유)',
        'options' => '✅ 아래 저장값으로 동작 중',
        default   => '⚠️ 미설정 — 업로드는 로컬로만 저장됩니다(무상태 환경에서는 비영속)',
    };
    ?>
    <div class="wrap">
      <h1>미디어 R2 offload</h1>
      <p><?php echo wp_kses($status, ['strong' => []]); ?></p>
      <form method="post" action="options.php">
        <?php settings_fields('qd_media_settings'); ?>
        <table class="form-table">
          <?php foreach (QD_MEDIA_SETTINGS_LABELS as $field => [$label, $desc]) :
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
        <?php submit_button('저장'); ?>
      </form>
      <p class="description">동작 검증은 QuizDeck 대시보드의 "R2 연결 테스트"로. 원본 오프로드 전용(중간 사이즈 기본 비활성 — <code>qd_media_disable_sizes</code> 필터) — 제약은 media/README.md 참조.</p>
    </div>
    <?php
}
