<?php
/**
 * Plugin Name:       QuizDeck CMS
 * Plugin URI:        https://github.com/young1ll/quizdeck
 * Description:       WordPress 를 QuizDeck(myquizdeck.com)의 headless CMS 로 만드는 단일 mu-plugin — platform(코드 소유 defines·headless 하드닝) · content(CPT 4종·검증 게이트·REST 서빙 계약·편집 웹훅) · media(R2 offload — 포터블 모듈) · locale(ko_KR 고정) · admin(운영 대시보드·편집 작업 큐). ADR-0025/0026.
 * Version:           2.4.1
 * Author:            young1ll
 * Author URI:        https://github.com/young1ll
 * Requires at least: 6.5
 * Requires PHP:      8.0
 * Text Domain:       quizdeck-cms
 * Update URI:        false
 *
 * Requires 근거: PHP 8.0 = match 식·str_contains(8.1+ 문법 미사용, 2026-07-14 grep 실사),
 * WP 6.5 = PHP 번역 파일(.l10n.php — media i18n). Update URI false = WP.org 동명 슬러그의
 * 업데이트 오탐 차단(비배포 플러그인 관례). License 헤더는 저장소가 무라이선스라 보류.
 *
 * mu-plugins 는 하위 디렉토리를 자동 로드하지 않는다 — quizdeck-cms/ 진입점 로더.
 * mu-plugin 채택 이유(ADR-0025 2단계): 활성화 단계 자체가 없고 UI 비활성화 불가 —
 * 이미지가 코드를 소유한다는 GitOps 원칙과 일치. admin 표시는 이 헤더가 대표한다.
 */
require_once __DIR__ . '/quizdeck-cms/plugin.php';
