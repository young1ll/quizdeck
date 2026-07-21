<?php
/**
 * wp-admin SSO (ADR-0028) — env 계약(no-op)·admin 클레임 게이트·role 매핑의 순수 로직 검증.
 * OIDC 왕복 자체는 플러그인(외부) 소유 — 여기선 우리 모듈(sso.php)의 게이트 함수만 검증한다.
 * 테스트 compose 는 QD_SSO_* env 를 주지 않으므로 no-op 경로가 곧 기본 상태다.
 */
require '/tests/_helpers.php';
echo "[91-sso]\n";

// ── env 부재 = 전체 no-op — 상수 미정의·플러그인 미로드·훅 미등록 ──
t_assert(qd_sso_config() === null, 'env 부재 → config null');
t_assert(!defined('OIDC_CLIENT_ID') && !defined('OIDC_LOGIN_TYPE'), 'no-op: OIDC 상수 미정의');
t_assert(!class_exists('OpenID_Connect_Generic'), 'no-op: 클라이언트 플러그인 미로드');
t_assert(!has_filter('openid-connect-generic-user-login-test'), 'no-op: 게이트 훅 미등록');

// ── admin 클레임 게이트 — lib/admin.ts isAdminRole 과 같은 규칙 ──
t_assert(qd_sso_claim_is_admin(['role' => 'admin']) === true, "role='admin' 통과");
t_assert(qd_sso_claim_is_admin(['role' => 'user,admin']) === true, '콤마 다중 role 에 admin 포함 통과');
t_assert(qd_sso_claim_is_admin(['role' => 'user']) === false, "role='user' 거부");
t_assert(qd_sso_claim_is_admin(['role' => 'administrator']) === false, '유사 문자열(administrator) 거부');
t_assert(qd_sso_claim_is_admin(['role' => null]) === false, 'role null 거부');
t_assert(qd_sso_claim_is_admin(['role' => '']) === false, 'role 빈 문자열 거부');
t_assert(qd_sso_claim_is_admin([]) === false, 'role 클레임 부재 거부');
t_assert(qd_sso_claim_is_admin(['role' => 123]) === false, 'role 비문자열 거부');

// ── 생성 사용자 role 매핑 ──
$data = qd_sso_user_data(['user_login' => 'appadmin', 'user_email' => 'a@x.com', 'role' => 'subscriber']);
t_assert($data['role'] === 'administrator', '생성 시 administrator 부여(플러그인 기본 role 덮어씀)');
t_assert($data['user_login'] === 'appadmin' && $data['user_email'] === 'a@x.com', '다른 필드 불변');

echo "OK\n";
