<?php
/**
 * media 모듈 — 업로드 미디어 R2 offload (ADR-0025 결정 7 의 2단계 완결).
 * 일반화·분리 배포 후보(결정 (c) 차순위): 이 디렉토리가 곧 추출 단위 — content 모듈에 의존하지 않는다.
 *
 * pod 는 무상태(/var/www/html = emptyDir)라 로컬 업로드 파일은 재시작에 소실되고,
 * WP 자체 URL(wp.myquizdeck.com)은 tailnet 전용이라 공개 사용자에게 안 보인다.
 * → 업로드 완료 시 원본을 R2 에 PUT 하고, URL 은 공개 미디어 도메인으로 파생한다.
 *
 * 오프로드 플러그인 대신 자체구현(quizdeck-content 의 ACF 결정과 같은 결): headless 라
 * 서드파티 오프로드 플러그인의 가치는 UI 뿐이고, 필요한 동작은 세 조각이 전부다 —
 *   1. 중간 사이즈 생성 비활성 — 서빙은 'full' 만 쓴다(rest.php). 업로드 1건 = R2 객체 1개.
 *   2. 업로드 훅에서 R2 PUT(SigV4) + `_qd_r2_key` 메타 기록. 첨부 메타는 MariaDB 에 남으므로
 *      pod 가 재시작해도 URL 파생은 계속 동작한다.
 *   3. wp_get_attachment_url 필터 — offload 된 첨부는 QD_MEDIA_BASE_URL 로.
 *
 * 설정은 env(QD_MEDIA_ENDPOINT·BUCKET·ACCESS_KEY_ID·SECRET_ACCESS_KEY·BASE_URL —
 * k8s wp-media Secret). 하나라도 없으면 전체 no-op(로컬 dev 는 로컬 URL 그대로).
 * PUT 실패 시 error_log + 메타 미기록 → URL 은 로컬로 남는다(공개엔 안 보이는 상태가
 * 유지될 뿐, 저작은 막지 않는다).
 */

defined('ABSPATH') || exit;

require_once __DIR__ . '/r2.php';

// i18n — 소스는 영어, 번역은 languages/*.l10n.php(WP 6.5+ PHP 번역 파일 — msgfmt 툴체인
// 불필요, 수기 유지). load_textdomain 은 .mo 경로를 받지만 컨트롤러가 .l10n.php 를 우선한다.
// 로그(error_log)는 관례대로 번역하지 않는다(영어 고정 — grep 가능성).
add_action('init', function (): void {
    load_textdomain('qd-media', __DIR__ . '/languages/qd-media-' . determine_locale() . '.mo');
});

/** 필드 → env 이름. 설정 폴백(options)의 키는 `qd_media_<field>`. */
function qd_media_fields(): array
{
    return ['endpoint' => 'QD_MEDIA_ENDPOINT', 'bucket' => 'QD_MEDIA_BUCKET',
            'key' => 'QD_MEDIA_ACCESS_KEY_ID', 'secret' => 'QD_MEDIA_SECRET_ACCESS_KEY',
            'base_url' => 'QD_MEDIA_BASE_URL'];
}

/**
 * 설정 소스 체인(일반화 (a), 2026-07-14): env **우선** → 없으면 admin 설정(options).
 * env 가 하나라도 있으면 options 와 혼합하지 않는다 — 소스 단위 전환(부분 설정 = 미설정,
 * 반쯤 켜진 상태 방지). QuizDeck 프로덕션은 항상 env(Secret) — 확정 경계 무변경.
 */
function qd_media_config(): ?array
{
    static $config = false;
    if ($config !== false) {
        return $config;
    }
    $envAny = false;
    foreach (qd_media_fields() as $env) {
        if (getenv($env)) { $envAny = true; break; }
    }
    $cfg = [];
    foreach (qd_media_fields() as $name => $env) {
        $v = $envAny ? (string) getenv($env) : (string) get_option("qd_media_{$name}", '');
        if ($v === '') {
            return $config = null;
        }
        $cfg[$name] = rtrim($v, '/');
    }
    return $config = $cfg;
}

/** 활성 소스 — 'env' | 'options' | null(미설정). 설정 페이지·대시보드 상태 표시용. */
function qd_media_config_source(): ?string
{
    if (qd_media_config() === null) {
        return null;
    }
    foreach (qd_media_fields() as $env) {
        if (getenv($env)) return 'env';
    }
    return 'options';
}

/* 중간 사이즈·-scaled 변형 비활성 — 기본 정책(QuizDeck 서빙 계약이 'full' 뿐).
   일반 사용처는 `qd_media_disable_sizes` 필터 false 로 WP 기본 동작 복원(원본만 offload — README). */
add_filter('intermediate_image_sizes_advanced',
    fn(array $sizes): array => apply_filters('qd_media_disable_sizes', true) ? [] : $sizes);
add_filter('big_image_size_threshold',
    fn($threshold) => apply_filters('qd_media_disable_sizes', true) ? false : $threshold);

require_once __DIR__ . '/settings.php';

/**
 * 업로드 완료 → R2 PUT. wp_generate_attachment_metadata 는 이미지 외 타입에도 돌므로
 * 모든 첨부가 offload 대상이다. admin 이미지 편집(자르기 등)도 이 필터를 다시 지나
 * 새 키로 재업로드된다(구 객체는 잔존 — 허용).
 */
add_filter('wp_generate_attachment_metadata', function (array $metadata, int $attachmentId): array {
    $cfg = qd_media_config();
    if (!$cfg) {
        return $metadata;
    }
    $file = get_attached_file($attachmentId, true); // unfiltered — 로컬 실경로
    $key  = get_post_meta($attachmentId, '_wp_attached_file', true); // uploads 상대경로 = R2 키
    $key  = (string) apply_filters('qd_media_object_key', $key, $attachmentId); // 키 정책 오버라이드 seam
    if (!$file || !$key || !is_readable($file)) {
        error_log("qd-media: attachment {$attachmentId} file unreadable — offload skipped");
        return $metadata;
    }
    $ok = qd_media_r2_put($cfg, $key, $file, get_post_mime_type($attachmentId) ?: 'application/octet-stream');
    if ($ok) {
        update_post_meta($attachmentId, '_qd_r2_key', $key);
    } else {
        error_log("qd-media: attachment {$attachmentId} R2 PUT failed — URL stays local (non-durable)");
    }
    return $metadata;
}, 20, 2);

/* offload 된 첨부의 URL = 공개 미디어 도메인. get_the_post_thumbnail_url('full') 도 이 필터를 지난다. */
add_filter('wp_get_attachment_url', function (string $url, int $attachmentId): string {
    $cfg = qd_media_config();
    if (!$cfg) {
        return $url;
    }
    $key = get_post_meta($attachmentId, '_qd_r2_key', true);
    return $key ? $cfg['base_url'] . '/' . $key : $url;
}, 10, 2);

/* 첨부 삭제 → R2 객체도 삭제(best-effort — 실패는 고아 객체로 남을 뿐). */
add_action('delete_attachment', function (int $attachmentId): void {
    $cfg = qd_media_config();
    if (!$cfg) {
        return;
    }
    $key = get_post_meta($attachmentId, '_qd_r2_key', true);
    if ($key && !qd_media_r2_delete($cfg, $key)) {
        error_log("qd-media: attachment {$attachmentId} R2 DELETE failed — orphan object: {$key}");
    }
});
