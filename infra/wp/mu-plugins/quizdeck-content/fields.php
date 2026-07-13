<?php
/**
 * 필드 스키마 SSOT — 메타박스 렌더·저장 sanitize·REST 노출·이관이 이 정의 하나를 공유한다.
 * type: text|textarea|int|json — json 은 postmeta 에 JSON 문자열로 저장(REST 에서 디코드).
 * 특수 위젯(options repeater·answer 체크박스·exam 관계 select)은 metabox.php 가 별도 렌더.
 */

defined('ABSPATH') || exit;

function qd_field_schema(): array
{
    return [
        'qd_exam' => [
            'qd_provider'      => ['type' => 'text', 'label' => 'provider', 'desc' => '예: aws', 'required' => true],
            'qd_slug'          => ['type' => 'text', 'label' => 'slug', 'desc' => '예: saa-c03', 'required' => true],
            'qd_provider_name' => ['type' => 'text', 'label' => 'provider 표시명', 'required' => true],
            'qd_code'          => ['type' => 'text', 'label' => '시험 코드', 'desc' => '예: SAA-C03', 'required' => true],
            'qd_language'      => ['type' => 'text', 'label' => '기본 언어', 'desc' => 'ko', 'default' => 'ko'],
            'qd_icon'          => ['type' => 'text', 'label' => '아이콘(이모지)'],
            'qd_track_id'      => ['type' => 'text', 'label' => '트랙 id', 'desc' => '예: aws-solutions-architect'],
            'qd_track_name'    => ['type' => 'text', 'label' => '트랙 표시명'],
            'qd_diagrams'      => ['type' => 'json', 'label' => 'diagrams (JSON)', 'default' => '[]'],
            'qd_q2svc'         => ['type' => 'json', 'label' => 'q2svc (JSON)', 'default' => '{}'],
            'qd_svc_icons'     => ['type' => 'json', 'label' => 'svc 아이콘 (JSON)', 'default' => '{}'],
        ],
        'qd_question' => [
            // qd_exam(관계)·qd_options·qd_answer 는 특수 위젯 — metabox.php
            'qd_qn'          => ['type' => 'int', 'label' => '문항 번호', 'desc' => '문제집 내 유일', 'required' => true],
            'qd_topic'       => ['type' => 'text', 'label' => '주제', 'desc' => '예: 📦 스토리지'],
            'qd_q'           => ['type' => 'textarea', 'label' => '지문', 'desc' => '**굵게** 마크업 허용', 'required' => true],
            'qd_explanation' => ['type' => 'textarea', 'label' => '해설'],
            'qd_tip'         => ['type' => 'textarea', 'label' => '팁'],
            'qd_page'        => ['type' => 'int', 'label' => '페이지'],
            'qd_deeplink'    => ['type' => 'text', 'label' => '딥링크'],
        ],
        'qd_concept' => [
            'qd_svc'    => ['type' => 'text', 'label' => '서비스/개념 식별자', 'desc' => 'q2svc 조인 키', 'required' => true],
            'qd_ord'    => ['type' => 'int', 'label' => '순서', 'required' => true],
            'qd_cat'    => ['type' => 'text', 'label' => '분류'],
            'qd_abbr'   => ['type' => 'text', 'label' => '축약'],
            'qd_deff'   => ['type' => 'textarea', 'label' => '정의', 'required' => true],
            'qd_key'    => ['type' => 'textarea', 'label' => '핵심 포인트'],
            'qd_when'   => ['type' => 'textarea', 'label' => '언제 쓰나'],
            'qd_trap'   => ['type' => 'textarea', 'label' => '함정'],
            'qd_vs'     => ['type' => 'textarea', 'label' => '비교'],
            'qd_detail' => ['type' => 'textarea', 'label' => '상세(선택)'],
            'qd_cost'   => ['type' => 'textarea', 'label' => '비용 특성(선택)'],
            'qd_rel'    => ['type' => 'json', 'label' => '관련 문항 번호 (JSON 배열)', 'default' => '[]'],
            'qd_reln'   => ['type' => 'int', 'label' => '관련 문항 총 개수'],
        ],
    ];
}

/** 관계·특수 메타 키(스키마 밖) — REST·이관에서 함께 다룬다. */
function qd_special_meta(string $post_type): array
{
    return match ($post_type) {
        'qd_question' => ['qd_exam_id', 'qd_options', 'qd_answer'],
        'qd_concept'  => ['qd_exam_id'],
        default       => [],
    };
}

/** 메타 sanitize — 타입별 단일 규칙. json 은 유효성만 확인하고 정규화(re-encode)해 저장. */
function qd_sanitize_meta(array $def, string $raw): array
{
    switch ($def['type']) {
        case 'int':
            if ($raw === '') return [null, null];
            if (!is_numeric($raw)) return [null, "{$def['label']}: 숫자가 아닙니다"];
            return [(string) (int) $raw, null];
        case 'json':
            $trimmed = trim($raw);
            if ($trimmed === '') return [$def['default'] ?? '', null];
            $decoded = json_decode($trimmed, true);
            if (json_last_error() !== JSON_ERROR_NONE) return [null, "{$def['label']}: JSON 파싱 실패"];
            return [wp_json_encode($decoded, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), null];
        case 'textarea':
            return [sanitize_textarea_field($raw), null];
        default:
            return [sanitize_text_field($raw), null];
    }
}
