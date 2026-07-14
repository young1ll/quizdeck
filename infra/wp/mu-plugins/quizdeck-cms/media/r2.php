<?php
/**
 * R2 S3-호환 클라이언트 — AWS SigV4 자체구현(PUT/DELETE 두 동작만).
 *
 * SDK(aws-sdk-php)를 이미지에 얹지 않는 이유: 필요한 표면이 서명된 PUT/DELETE 뿐이라
 * 의존성 무게가 코드 ~100줄보다 크다. region 은 R2 규약상 'auto', path-style
 * (endpoint/bucket/key). 전송은 WP HTTP API(wp_remote_request) — 코어가 소유한 스택.
 */

defined('ABSPATH') || exit;

/** 파일을 R2 에 PUT. 미디어 파일명은 WP 가 유일화하므로 불변 캐시 헤더를 준다. */
function qd_media_r2_put(array $cfg, string $key, string $file, string $contentType): bool
{
    $body = file_get_contents($file);
    if ($body === false) {
        return false;
    }
    $res = qd_media_r2_request($cfg, 'PUT', $key, $body, [
        'content-type'  => $contentType,
        // 파일명은 WP 가 유일화 — 불변 캐시가 기본. 사용처 정책은 필터로.
        'cache-control' => (string) apply_filters('qd_media_cache_control', 'public, max-age=31536000, immutable', $key),
    ]);
    return $res >= 200 && $res < 300;
}

/** R2 객체 삭제. S3 DELETE 는 부재 키에도 204 — 멱등. */
function qd_media_r2_delete(array $cfg, string $key): bool
{
    $res = qd_media_r2_request($cfg, 'DELETE', $key, '', []);
    return $res >= 200 && $res < 300;
}

/**
 * SigV4 서명 요청. $extraHeaders 의 키는 소문자 전제(정규화 헤더 목록에 그대로 합류).
 * 반환은 HTTP 상태 코드(전송 실패는 0).
 */
function qd_media_r2_request(array $cfg, string $method, string $key, string $body, array $extraHeaders): int
{
    $host = parse_url($cfg['endpoint'], PHP_URL_HOST);
    if (!$host) {
        error_log("qd-media: QD_MEDIA_ENDPOINT 파싱 실패");
        return 0;
    }
    // 서명의 host 는 실제 전송되는 Host 헤더와 바이트 단위로 같아야 한다 — 비표준 포트 포함
    // (예: 로컬 MinIO :9000. 포트를 빼면 SignatureDoesNotMatch).
    $port   = parse_url($cfg['endpoint'], PHP_URL_PORT);
    $scheme = parse_url($cfg['endpoint'], PHP_URL_SCHEME);
    if ($port && $port !== ($scheme === 'https' ? 443 : 80)) {
        $host .= ':' . $port;
    }
    // canonical URI — 세그먼트별 rawurlencode('/' 보존). 키는 _wp_attached_file(예: 2026/07/a.png).
    $path = '/' . implode('/', array_map('rawurlencode', explode('/', $cfg['bucket'] . '/' . $key)));

    $amzDate     = gmdate('Ymd\THis\Z');
    $dateStamp   = gmdate('Ymd');
    $payloadHash = hash('sha256', $body);
    $scope       = "{$dateStamp}/auto/s3/aws4_request";

    $headers = $extraHeaders + [
        'host'                 => $host,
        'x-amz-content-sha256' => $payloadHash,
        'x-amz-date'           => $amzDate,
    ];
    ksort($headers);
    $canonicalHeaders = '';
    foreach ($headers as $name => $value) {
        $canonicalHeaders .= $name . ':' . trim($value) . "\n";
    }
    $signedHeaders = implode(';', array_keys($headers));

    $canonicalRequest = implode("\n", [$method, $path, '', $canonicalHeaders, $signedHeaders, $payloadHash]);
    $stringToSign     = implode("\n", ['AWS4-HMAC-SHA256', $amzDate, $scope, hash('sha256', $canonicalRequest)]);

    $k = hash_hmac('sha256', $dateStamp, 'AWS4' . $cfg['secret'], true);
    foreach (['auto', 's3', 'aws4_request'] as $step) {
        $k = hash_hmac('sha256', $step, $k, true);
    }
    $signature = hash_hmac('sha256', $stringToSign, $k);

    $headers['authorization'] = "AWS4-HMAC-SHA256 Credential={$cfg['key']}/{$scope}, "
        . "SignedHeaders={$signedHeaders}, Signature={$signature}";
    unset($headers['host']); // WP HTTP API 가 URL 에서 스스로 설정

    $res = wp_remote_request($cfg['endpoint'] . $path, [
        'method'  => $method,
        'headers' => $headers,
        'body'    => $body,
        'timeout' => 30,
    ]);
    if (is_wp_error($res)) {
        error_log('qd-media: R2 전송 실패 — ' . $res->get_error_message());
        return 0;
    }
    $code = (int) wp_remote_retrieve_response_code($res);
    if ($code < 200 || $code >= 300) {
        error_log("qd-media: R2 {$method} {$key} → {$code} " . substr(wp_remote_retrieve_body($res), 0, 200));
    }
    return $code;
}
