<?php
/** CPT 3종 등록 — public=false(headless: 프론트 라우팅 없음), show_ui(저작), show_in_rest(서빙·이관). */

defined('ABSPATH') || exit;

add_action('init', function () {
    $common = [
        'public'       => false,
        'show_ui'      => true,
        'show_in_menu' => 'quizdeck-cms', // 최상위 QuizDeck 메뉴(admin.php)의 서브메뉴로 — 메뉴트리 단일화
        'show_in_rest' => true, // published = 익명 read, draft = 인증 필요 (WP 기본 — 서빙 계약)
        'supports'     => ['title'],
        'map_meta_cap' => true,
    ];

    register_post_type('qd_exam', $common + [
        'labels'    => qd_labels('문제집'),
        'menu_icon' => 'dashicons-portfolio',
        'rest_base' => 'qd-exams',
        'supports'  => ['title', 'thumbnail'], // thumbnail = 이미지 아이콘(이모지 오버라이드)
    ]);

    register_post_type('qd_question', $common + [
        'labels'    => qd_labels('문항'),
        'menu_icon' => 'dashicons-editor-help',
        'rest_base' => 'qd-questions',
        'supports'  => ['title', 'thumbnail'], // thumbnail = 지문 이미지(WP 네이티브 미디어)
    ]);

    register_post_type('qd_concept', $common + [
        'labels'    => qd_labels('개념 카드'),
        'menu_icon' => 'dashicons-lightbulb',
        'rest_base' => 'qd-concepts',
        'supports'  => ['title', 'thumbnail'], // thumbnail = 카드 이미지(R2 offload)
    ]);

    register_post_type('qd_diagram', $common + [
        'labels'    => qd_labels('다이어그램'),
        'menu_icon' => 'dashicons-chart-area',
        'rest_base' => 'qd-diagrams',
        'supports'  => ['title', 'thumbnail'], // thumbnail = SVG 대신 래스터 이미지 경로
    ]);

    // provider 귀속 — 시험 관계(qd_exam_id) 없음. ADR-0026.
    register_post_type('qd_service', $common + [
        'labels'    => qd_labels('서비스'),
        'menu_icon' => 'dashicons-cloud',
        'rest_base' => 'qd-services',
        'supports'  => ['title', 'thumbnail'], // thumbnail = 아이콘 이미지(데이터 URI 대체)
    ]);
});

function qd_labels(string $name): array
{
    return [
        'name'          => $name,
        'singular_name' => $name,
        'add_new_item'  => "새 {$name} 추가",
        'edit_item'     => "{$name} 편집",
        'not_found'     => "{$name}이(가) 없습니다",
    ];
}
