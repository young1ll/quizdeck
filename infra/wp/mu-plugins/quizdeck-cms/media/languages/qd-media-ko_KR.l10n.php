<?php
/**
 * ko_KR 번역 — WP 6.5+ PHP 번역 파일(.mo 대체, 수기 유지 — msgfmt 불필요).
 * 소스(영어) 문자열이 바뀌면 여기 키도 같이 — settings.php 가 유일한 소비처.
 */
return [
    'project-id-version' => 'qd-media',
    'messages'           => [
        'R2/S3 endpoint'      => 'R2/S3 엔드포인트',
        'Bucket'              => '버킷',
        'Access Key ID'       => 'Access Key ID',
        'Secret Access Key'   => 'Secret Access Key',
        'Stored as plain text in the database — prefer env (QD_MEDIA_*) when possible'
            => '⚠️ DB(options)에 평문 저장 — 가능하면 env(QD_MEDIA_*) 권장',
        'e.g. https://media.example.com — the bucket\'s public (custom) domain'
            => '예: https://media.example.com — 버킷의 공개(커스텀) 도메인',
        'Public media domain' => '공개 미디어 도메인',
        'Media R2 Offload'    => '미디어 R2 offload',
        'Media (R2)'          => '미디어(R2)',
        '<strong>Environment variables (QD_MEDIA_*) take precedence</strong> — values saved below are ignored.'
            => '✅ <strong>환경변수(QD_MEDIA_*)가 우선 적용 중</strong> — 아래 저장값은 무시됩니다 (QuizDeck 프로덕션의 정상 상태: 자격증명은 Secret 소유)',
        'Active — using the values saved below.'
            => '✅ 아래 저장값으로 동작 중',
        'Not configured — uploads stay local only (non-durable on stateless hosts).'
            => '⚠️ 미설정 — 업로드는 로컬로만 저장됩니다(무상태 환경에서는 비영속)',
        'Offloads originals only — intermediate sizes are disabled by default (qd_media_disable_sizes filter). See media/README.md for constraints.'
            => '원본 오프로드 전용 — 중간 사이즈는 기본 비활성(qd_media_disable_sizes 필터). 제약은 media/README.md 참조. 동작 검증은 QuizDeck 대시보드의 "R2 연결 테스트"로.',
    ],
];
