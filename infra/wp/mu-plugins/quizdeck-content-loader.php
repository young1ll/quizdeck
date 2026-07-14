<?php
/**
 * Plugin Name: QuizDeck Content
 * Description: 문제집·문항·개념 카드 CPT + 메타박스 + 검증 게이트(정답⊆보기·qn 불변) + REST + 편집 웹훅 + 서비스 레지스트리 (ADR-0025/0026)
 * Version: 1.0.0
 *
 * mu-plugins 는 하위 디렉토리를 자동 로드하지 않는다 — quizdeck-content/ 진입점 로더.
 * mu-plugin 채택 이유(ADR-0025 2단계): 활성화 단계 자체가 없고 UI 비활성화 불가 —
 * 이미지가 코드를 소유한다는 GitOps 원칙과 일치. admin 표시는 이 헤더가 대표한다.
 */
require_once __DIR__ . '/quizdeck-content/plugin.php';
