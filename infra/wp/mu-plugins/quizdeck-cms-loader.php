<?php
/**
 * Plugin Name: QuizDeck CMS
 * Description: WordPress 를 QuizDeck 의 headless CMS 로 — 콘텐츠 모델(CPT·메타박스·검증 게이트) + REST 서빙 계약 + 편집 웹훅 + 미디어 R2 offload + ko_KR 고정 (ADR-0025/0026)
 * Version: 2.1.0
 *
 * mu-plugins 는 하위 디렉토리를 자동 로드하지 않는다 — quizdeck-cms/ 진입점 로더.
 * mu-plugin 채택 이유(ADR-0025 2단계): 활성화 단계 자체가 없고 UI 비활성화 불가 —
 * 이미지가 코드를 소유한다는 GitOps 원칙과 일치. admin 표시는 이 헤더가 대표한다.
 */
require_once __DIR__ . '/quizdeck-cms/plugin.php';
