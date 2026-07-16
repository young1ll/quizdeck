<?php
/**
 * 회원 주석 관리 (ADR-0027) — env 계약·exam 제목 매핑·앱 API 왕복(pre_http_request 스텁)·렌더 스모크.
 * 앱 없이 검증한다: WP 네이티브 훅으로 HTTP 를 가로채 요청(메서드·헤더·body)을 단언한다.
 */
require '/tests/_helpers.php';
echo "[90-annotations]\n";

// ── 1. env 부재 — fail-closed(발사 안 함, 화면은 안내) ──
putenv('QD_ADMIN_API_URL');
putenv('QD_ADMIN_API_TOKEN');
t_assert(qd_anno_config() === null, 'env 부재 → config null');
[$ok, $msg] = qd_anno_do_update('anno-1', 'highlight', '메모');
t_assert($ok === false && str_contains($msg, '미설정'), 'env 부재 → 수정 시도는 미설정 보고 (발사 안 함)');
ob_start();
qd_anno_render();
$html = ob_get_clean();
t_assert(str_contains($html, '회원 주석 관리') && str_contains($html, 'QD_ADMIN_API_URL'), 'env 부재 렌더 = 미설정 안내');

// ── 2. exam 제목 매핑 — 픽스처 히트 / 미등록 키 raw ──
t_assert(qd_anno_exam_title('aws/test-01') === 'TEST-01 (aws/test-01)', 'exam_key → 시험명 매핑 (픽스처)');
t_assert(qd_anno_exam_title('gone/exam') === 'gone/exam', '미등록 exam_key → raw 반환');

// ── 3. HTTP 스텁 왕복 — 요청 캡처 + 응답 주입 ──
putenv('QD_ADMIN_API_URL=http://app.test.invalid/api/admin');
putenv('QD_ADMIN_API_TOKEN=test-token');

$captured = [];
$stubResponse = ['code' => 204, 'body' => ''];
$stub = function ($pre, array $args, string $url) use (&$captured, &$stubResponse) {
    $captured[] = ['url' => $url, 'method' => $args['method'] ?? 'GET',
        'headers' => $args['headers'] ?? [], 'body' => $args['body'] ?? null];
    return ['headers' => [], 'body' => $stubResponse['body'], 'cookies' => [], 'filename' => null,
        'response' => ['code' => $stubResponse['code'], 'message' => '']];
};
add_filter('pre_http_request', $stub, 10, 3);

// 수정 — PATCH + 토큰/actor 헤더 + body(id·memo·kind), 204 → 성공
[$ok, $msg] = qd_anno_do_update('anno-1', 'underline', '고친 메모');
$req = array_pop($captured);
$reqBody = json_decode((string) $req['body'], true);
t_assert($ok === true && str_contains($msg, '수정'), '수정 204 → 성공 알림');
t_assert($req['url'] === 'http://app.test.invalid/api/admin/annotations' && $req['method'] === 'PATCH',
    '수정 = PATCH /annotations');
t_assert(($req['headers']['X-QD-Token'] ?? '') === 'test-token' && isset($req['headers']['X-QD-Actor']),
    '공유 토큰 + 조작자 헤더 동봉');
t_assert($reqBody === ['id' => 'anno-1', 'memo' => '고친 메모', 'kind' => 'underline'],
    'body = id·memo·kind (위치 정보 미전송)');

// memo 빈 문자열 → null(메모 삭제)
qd_anno_do_update('anno-1', 'highlight', '');
$req = array_pop($captured);
t_assert(json_decode((string) $req['body'], true) === ['id' => 'anno-1', 'memo' => null, 'kind' => 'highlight'],
    '빈 memo → null 전송 (메모 삭제)');

// 삭제 — DELETE ?id=
[$ok, $msg] = qd_anno_do_delete('anno-2');
$req = array_pop($captured);
t_assert($ok === true && $req['method'] === 'DELETE'
    && $req['url'] === 'http://app.test.invalid/api/admin/annotations?id=anno-2', '삭제 = DELETE ?id=');

// 실패 응답 — 401/404 는 실패 알림
$stubResponse = ['code' => 401, 'body' => 'unauthorized'];
[$ok, $msg] = qd_anno_do_update('anno-1', 'highlight', 'x');
t_assert($ok === false && str_contains($msg, '401'), '401 → 실패 알림 (HTTP 코드 노출)');
$stubResponse = ['code' => 404, 'body' => 'not found'];
[$ok, $msg] = qd_anno_do_delete('gone');
t_assert($ok === false && str_contains($msg, '404'), '404 → 실패 알림');

// ── 4. 렌더 스모크 — 목록·상세 (스텁이 JSON 반환) ──
$stubResponse = ['code' => 200, 'body' => (string) wp_json_encode([
    ['id' => 'u1', 'name' => '학습자', 'email' => 'learner@test.local', 'emailVerified' => true,
     'annotationCount' => 2, 'lastAnnotatedAt' => 1752600000000],
])];
ob_start();
qd_anno_render_list();
$html = ob_get_clean();
t_assert(str_contains($html, 'learner@test.local') && str_contains($html, '주석 보기'),
    '목록 렌더 (회원·주석 보기 링크)');

$stubResponse = ['code' => 200, 'body' => (string) wp_json_encode([
    'learner' => ['id' => 'u1', 'name' => '학습자', 'email' => 'learner@test.local', 'emailVerified' => true],
    'annotations' => [
        ['id' => 'a1', 'examKey' => 'aws/test-01', 'qn' => 3, 'lang' => 'ko', 'field' => 'q',
         'kind' => 'highlight', 'memo' => '헷갈림', 'anchor' => ['quote' => '객체 스토리지', 'prefix' => '', 'suffix' => ''],
         'updatedAt' => 1752600000000],
        ['id' => 'a2', 'examKey' => 'gone/exam', 'qn' => 1, 'lang' => 'en', 'field' => 'opt:B',
         'kind' => 'underline', 'memo' => null, 'anchor' => ['quote' => 'deprecated', 'prefix' => '', 'suffix' => ''],
         'updatedAt' => 1752600000000],
    ],
])];
ob_start();
qd_anno_render_detail('u1');
$html = ob_get_clean();
t_assert(str_contains($html, 'TEST-01 (aws/test-01)') && str_contains($html, 'gone/exam'),
    '상세 렌더: 시험 그룹 헤더 (매핑 + raw 폴백)');
t_assert(str_contains($html, '객체 스토리지') && str_contains($html, '보기 B'),
    '상세 렌더: 인용·field 라벨');
t_assert(str_contains($html, 'qd_anno_update') && str_contains($html, 'qd_anno_delete')
    && str_contains($html, 'confirm('), '상세 렌더: 수정·삭제 폼 + 삭제 confirm');
t_assert(substr_count($html, '_wpnonce') >= 4, '상세 렌더: 행 단위 nonce (수정·삭제 × 행)');

// ── 정리 — 후속 케이스 오염 방지 ──
remove_filter('pre_http_request', $stub, 10);
putenv('QD_ADMIN_API_URL');
putenv('QD_ADMIN_API_TOKEN');
echo "OK\n";
