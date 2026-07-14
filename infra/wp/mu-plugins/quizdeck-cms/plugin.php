<?php
/**
 * QuizDeck CMS — 모듈 로더. 모듈 경계는 의도적(2026-07-14 통합 결정):
 *   platform  WP 플랫폼 행동 — 코드 소유 defines·XML-RPC 차단·headless 하드닝
 *   content/  콘텐츠 모델 — CPT 4종·메타박스·검증 게이트·REST·웹훅·사이트 설정
 *   media/    업로드 R2 offload — 일반화·분리 배포 후보(결정 (c) 차순위)라 경계 유지
 *   locale    사이트 언어 ko_KR 고정
 * 추출 시 모듈 디렉토리를 들어내고 로더만 붙이면 된다 — 경계가 곧 추출 단위.
 */

defined('ABSPATH') || exit;

require_once __DIR__ . '/platform.php';
require_once __DIR__ . '/content/plugin.php';
require_once __DIR__ . '/media/plugin.php';
require_once __DIR__ . '/locale.php';
require_once __DIR__ . '/admin.php'; // 조합 계층 — 모듈을 읽는 대시보드(모듈은 admin 무의존)
