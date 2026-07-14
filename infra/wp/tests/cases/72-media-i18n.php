<?php
/** media i18n — 영어 소스 + ko_KR 카탈로그(.l10n.php). 사이트 로케일(ko_KR 고정)에서 한국어 렌더. */
require '/tests/_helpers.php';
echo "[72-media-i18n]\n";

t_assert(determine_locale() === 'ko_KR', '사이트 로케일 = ko_KR (locale 모듈)');
t_assert(__('Bucket', 'qd-media') === '버킷', 'ko_KR 카탈로그 적용 (Bucket → 버킷)');
t_assert(__('Media (R2)', 'qd-media') === '미디어(R2)', '메뉴 라벨 번역');

ob_start();
qd_media_render_settings();
$html = ob_get_clean();
t_assert(str_contains($html, '미디어 R2 offload') && str_contains($html, '엔드포인트'), '설정 페이지 한국어 렌더');
t_assert(str_contains($html, '환경변수(QD_MEDIA_*)가 우선 적용 중'), 'env 우선 상태 문구(번역) 표시');

// 로케일 전환 → 영어 소스 폴백 (일반화: 비한국어 사용처 기본 경험)
switch_to_locale('en_US');
t_assert(__('Bucket', 'qd-media') === 'Bucket', 'en_US → 영어 소스 폴백');
restore_previous_locale();
t_assert(__('Bucket', 'qd-media') === '버킷', '로케일 복원 → 다시 한국어');
echo "OK\n";
