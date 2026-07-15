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
            // diagrams 블롭은 qd_diagram CPT 로 승격(2026-07-14) — REST 투영이 CPT 에서 파생,
            // 구 블롭 meta 는 이관 전 폴백으로만 읽힌다(rest.php qd_derived_diagrams).
            'qd_q2svc'         => ['type' => 'json', 'label' => 'q2svc (JSON)', 'default' => '{}'],
            // svc_icons 블롭은 편집 표면에서 폐기(2026-07-15) — 아이콘은 엔티티(서비스 대표이미지·
            // 카드 qd_icon)가 소유. 기존 meta 는 rest.php 파생의 휴면 폴백으로만 읽힌다.
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
            'qd_svc'    => ['type' => 'text', 'label' => '카드 식별자', 'desc' => 'q2svc 조인 키(시험 내 유일)', 'required' => true],
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
            // 참조 서비스(ADR-0026 — CONTEXT '서비스'/'개념 카드' 2층): 단일 서비스 카드 1개,
            // 비교·묶음 카드 여러 개, 전략 카드 0개. rel/reln 은 저장하지 않는다 — q2svc 단일
            // 소스에서 REST 투영이 파생(구 저장 필드는 드리프트 실사로 폐기).
            'qd_service_ids' => ['type' => 'json', 'label' => '참조 서비스 id (JSON 배열)', 'desc' => '예: ["amazon-efs"]', 'default' => '[]'],
            // 카드 자체 아이콘(오버라이드) — 비우면 첫 참조 서비스에서 파생(ADR-0026 확장:
            // 정체성은 서비스 소유, 카드는 명시 오버라이드 가능 — 미참조 카드의 아이콘 경로).
            'qd_icon'        => ['type' => 'text', 'label' => '아이콘(이모지·이미지 URL — 선택)', 'desc' => '비우면 참조 서비스 아이콘'],
        ],
        // exam 귀속 다이어그램 — 구 exam 블롭에서 CPT 승격(개별 편집·게이트·리비전·웹훅).
        // 제목은 post_title(사용자 소유 — exam name 과 같은 규율).
        'qd_diagram' => [
            'qd_diag_id'  => ['type' => 'text', 'label' => '다이어그램 id', 'desc' => '언어 무관 안정 키(시험 내 유일)', 'required' => true],
            'qd_ord'      => ['type' => 'int', 'label' => '순서', 'required' => true],
            'qd_cat'      => ['type' => 'text', 'label' => '분류'],
            'qd_caption'  => ['type' => 'textarea', 'label' => '캡션'],
            'qd_svg'      => ['type' => 'textarea', 'label' => 'SVG 마크업', 'desc' => '인라인 <svg …> 전체 — 비우면 대표이미지가 필수'],
        ],
        // provider 귀속 서비스 레지스트리(ADR-0026) — 정체성(id·이름·약어·아이콘·분류)의 단일
        // 소스. 개념 카드(시험 눈높이 학습 노트)와 분리 — 같은 서비스라도 카드는 시험마다 다르다.
        'qd_service' => [
            'qd_service_id' => ['type' => 'text', 'label' => '서비스 id', 'desc' => '언어 무관 안정 키 — 소문자·숫자·하이픈(예: amazon-efs). 라벨을 키로 쓰지 않는다', 'required' => true],
            'qd_provider'   => ['type' => 'text', 'label' => 'provider', 'desc' => '예: aws', 'required' => true],
            'qd_name'       => ['type' => 'text', 'label' => '이름', 'required' => true],
            'qd_abbr'       => ['type' => 'text', 'label' => '축약'],
            'qd_icon'       => ['type' => 'text', 'label' => '아이콘(이모지)'],
            'qd_cat'        => ['type' => 'text', 'label' => '분류'],
        ],
    ];
}

/** 관계·특수 메타 키(스키마 밖) — REST·이관에서 함께 다룬다. */
function qd_special_meta(string $post_type): array
{
    return match ($post_type) {
        'qd_question' => ['qd_exam_id', 'qd_options', 'qd_answer'],
        'qd_concept'  => ['qd_exam_id'],
        'qd_diagram'  => ['qd_exam_id'],
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
            // 원문 보존 — sanitize_textarea_field 는 strip_tags 로 본문 속 '<'·'>' 구간을 삭제해
            // 충실 이관을 깨뜨린다(diff 실사). 저작 표면이 전부 인증(edit_posts) 뒤이고 앱 렌더러가
            // 이스케이프하므로 개행 정규화만 한다.
            return [str_replace(["\r\n", "\r"], "\n", $raw), null];
        default:
            return [sanitize_text_field($raw), null];
    }
}
