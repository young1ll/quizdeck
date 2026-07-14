<?php
/**
 * Plugin Name: QuizDeck Media
 * Description: 업로드 미디어 R2 offload — 중간 사이즈 비활성 + SigV4 PUT + media.myquizdeck.com URL 파생 (ADR-0025)
 * Version: 1.0.0
 *
 * quizdeck-media/ 진입점 로더 — mu-plugins 는 하위 디렉토리를 자동 로드하지 않는다.
 */
require_once __DIR__ . '/quizdeck-media/plugin.php';
