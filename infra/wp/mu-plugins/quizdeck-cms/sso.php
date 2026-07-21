<?php
/**
 * wp-admin SSO (ADR-0028) — QuizDeck 앱(Better Auth, OAuth 2.1 provider)을 OIDC IdP 로 쓰는
 * "QuizDeck 계정으로 로그인". 클라이언트 구현은 이미지에 구운 daggerhart-openid-connect-generic
 * (Dockerfile — 버전·해시 고정)이고, 이 모듈은 코드 소유 원칙대로 설정(상수가 DB 옵션에 우선)과
 * 강제 로드(require — DB active_plugins 무관)와 게이트만 소유한다.
 *  · role=admin 앱 계정만 통과(user-login-test / user-creation-test) → WP administrator 매핑.
 *  · login_type=button — wp-login.php 로컬 폼 폴백 유지(앱 장애 시에도 CMS 로그인 가능,
 *    readinessProbe 도 wp-login.php 를 문다).
 *  · ID 토큰 서명은 앱 JWKS(EdDSA/Ed25519)로 검증 — 번들 php-jwt 가 OKP 지원 + 이미지에 sodium.
 *  · env(QD_SSO_CLIENT_ID·QD_SSO_CLIENT_SECRET — Secret wp-sso) 미설정이면 전체 no-op(후퇴 경로).
 */

defined('ABSPATH') || exit;

/** env 계약 — ['client_id','client_secret','app'] 또는 null(미설정 = SSO 전체 no-op). */
function qd_sso_config(): ?array
{
    $clientId = getenv('QD_SSO_CLIENT_ID');
    $secret   = getenv('QD_SSO_CLIENT_SECRET');
    if (!$clientId || !$secret) return null;
    // 로컬 검증에서만 오버라이드(admin.php qd_app_url 과 같은 env) — 프로드는 기본값.
    $app = rtrim(getenv('QD_SSO_APP_URL') ?: 'https://myquizdeck.com', '/');
    return ['client_id' => $clientId, 'client_secret' => $secret, 'app' => $app];
}

/** role 클레임이 admin 인가 — 앱 lib/admin.ts isAdminRole 과 같은 규칙(콤마 다중 role 안전). */
function qd_sso_claim_is_admin(array $claim): bool
{
    $role = $claim['role'] ?? null;
    if (!is_string($role) || $role === '') return false;
    return in_array('admin', array_map('trim', explode(',', $role)), true);
}

/** 신규 생성 사용자 데이터 — 게이트(login/creation-test)를 통과한 클레임 = admin 이므로 administrator. */
function qd_sso_user_data(array $data): array
{
    $data['role'] = 'administrator';
    return $data;
}

$qdSsoCfg = qd_sso_config();
if ($qdSsoCfg !== null) {
    // 상수가 admin 설정(DB 옵션)에 우선한다 — 설정 화면에서 바꿔도 코드가 이긴다(GitOps).
    define('OIDC_CLIENT_ID', $qdSsoCfg['client_id']);
    define('OIDC_CLIENT_SECRET', $qdSsoCfg['client_secret']);
    define('OIDC_ENDPOINT_LOGIN_URL', $qdSsoCfg['app'] . '/api/auth/oauth2/authorize');
    define('OIDC_ENDPOINT_TOKEN_URL', $qdSsoCfg['app'] . '/api/auth/oauth2/token');
    define('OIDC_ENDPOINT_USERINFO_URL', $qdSsoCfg['app'] . '/api/auth/oauth2/userinfo');
    define('OIDC_ENDPOINT_JWKS_URL', $qdSsoCfg['app'] . '/api/auth/jwks');
    define('OIDC_ISSUER', $qdSsoCfg['app'] . '/api/auth');
    define('OIDC_LOGIN_TYPE', 'button'); // 로컬 폼 유지 — auto(강제 리다이렉트) 금지
    define('OIDC_CLIENT_SCOPE', 'openid profile email');
    define('OIDC_CREATE_IF_DOES_NOT_EXIST', true);
    define('OIDC_LINK_EXISTING_USERS', true); // 같은 이메일의 기존 WP 계정이 있으면 연결

    require WP_PLUGIN_DIR . '/daggerhart-openid-connect-generic/openid-connect-generic.php';

    // 상수 없는 설정은 settings 필터로 — Better Auth userinfo 엔 preferred_username 이 없어
    // 기본 nickname_key(preferred_username)가 하드 에러를 낸다(로컬 E2E 실측). name 클레임으로 매핑.
    add_filter('openid-connect-generic-settings', function (object $settings): object {
        $settings->nickname_key    = 'name';
        $settings->displayname_key = 'name';
        return $settings;
    });

    // 게이트 — role=admin 클레임이 아니면 로그인·계정 생성 모두 거부.
    add_filter('openid-connect-generic-user-login-test',
        fn($allow, $claim): bool => (bool) $allow && is_array($claim) && qd_sso_claim_is_admin($claim), 10, 2);
    add_filter('openid-connect-generic-user-creation-test',
        fn($create, $claim): bool => (bool) $create && is_array($claim) && qd_sso_claim_is_admin($claim), 10, 2);
    add_filter('openid-connect-generic-alter-user-data',
        fn(array $data): array => qd_sso_user_data($data), 10, 1);
    // 재로그인마다 role 재동기화 — WP 쪽에서 강등돼 있어도 SSO(=앱 admin)면 administrator 복구.
    add_action('openid-connect-generic-update-user-using-current-claim',
        function (WP_User $user): void { $user->set_role('administrator'); }, 10, 1);
    add_filter('openid-connect-generic-login-button-text',
        static fn(): string => 'QuizDeck 계정으로 로그인');
}
