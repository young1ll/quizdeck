<?php
/**
 * QuizDeck Content — 문제집·문항·개념 CPT + 메타박스 + 검증 + REST (ADR-0025 2단계).
 *
 * ACF 대체 자체구현(사용자 결정 2026-07-13): headless 라 admin UI 만이 필드 프레임워크의
 * 가치인데, 목적 제작 폼이 퀴즈 데이터엔 UX 도 저장 포맷도 낫다 —
 *   - 필드당 단일 postmeta, 구조 필드(보기·정답·JSON 산출물)는 JSON 문자열 1개
 *   - 정답은 "보기 key 체크박스"로 렌더 → 정답⊄보기가 구조적으로 불가능
 *   - (exam, qn)·(exam, svc) 유일성은 저장 시 검증, 실패하면 draft 강등 + 관리자 알림
 *   - REST 는 `qd` 단일 필드로 타입 있는 구조를 노출(published 익명 read — 서빙 계약)
 */

defined('ABSPATH') || exit;

define('QD_CONTENT_DIR', __DIR__);

require_once __DIR__ . '/cpt.php';
require_once __DIR__ . '/fields.php';
require_once __DIR__ . '/metabox.php';
require_once __DIR__ . '/save.php';
require_once __DIR__ . '/rest.php';
require_once __DIR__ . '/query.php';
require_once __DIR__ . '/webhook.php';
