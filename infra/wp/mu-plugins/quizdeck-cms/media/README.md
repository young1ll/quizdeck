# media 모듈 — 경량 R2/S3 오프로드

업로드 원본을 S3 호환 스토리지(Cloudflare R2 등)에 PUT 하고, 첨부 URL 을 공개 미디어
도메인으로 파생하는 mu-plugin 모듈. SDK·서드파티 의존성 없음(SigV4 자체구현, WP HTTP API).
무상태(pod·컨테이너) WP 에서 업로드를 영속화하는 것이 원래 목적이다(ADR-0025).

## 단독 사용 (QuizDeck 밖)

이 디렉토리를 `wp-content/mu-plugins/<이름>/` 으로 복사하고 로더 한 줄:

```php
<?php // wp-content/mu-plugins/media-loader.php
require_once __DIR__ . '/<이름>/plugin.php';
```

## 설정 — 소스 체인 (env 우선 → admin 설정)

| env | admin 설정(options 키) | 값 |
|---|---|---|
| `QD_MEDIA_ENDPOINT` | `qd_media_endpoint` | `https://<account>.r2.cloudflarestorage.com` |
| `QD_MEDIA_BUCKET` | `qd_media_bucket` | 버킷 이름 |
| `QD_MEDIA_ACCESS_KEY_ID` | `qd_media_key` | 버킷 스코프 토큰 권장 |
| `QD_MEDIA_SECRET_ACCESS_KEY` | `qd_media_secret` | ⚠️ options 는 DB 평문 — 가능하면 env |
| `QD_MEDIA_BASE_URL` | `qd_media_base_url` | 버킷의 공개(커스텀) 도메인 |

- env 가 **하나라도** 있으면 env 소스만 쓴다(options 와 혼합 없음). 5종 미완 = 전체 no-op.
- 설정 UI: 설정 → 미디어(R2). 부모 메뉴는 `qd_media_settings_parent` 필터로 변경 가능.

## 동작·제약

- 업로드 완료 훅에서 **원본만** PUT → `_qd_r2_key` 메타 기록 → `wp_get_attachment_url` 이
  `BASE_URL/키` 반환. 첨부 삭제 시 객체 삭제(best-effort).
- **중간 사이즈는 기본 비활성**(업로드 1건 = 객체 1개). WP 기본 사이즈 생성이 필요하면
  `add_filter('qd_media_disable_sizes', '__return_false')` — 단, 사이즈 파일은 오프로드되지
  않는다(원본 오프로드 전용 — srcset 재작성 미지원이 이 모듈의 의도된 경계).
- PUT 실패 시 업로드는 막지 않는다 — URL 이 로컬로 남고 error_log 에 기록.

## 필터

| 필터 | 기본 | 용도 |
|---|---|---|
| `qd_media_disable_sizes` | `true` | 중간 사이즈·-scaled 생성 억제 |
| `qd_media_object_key` | uploads 상대경로 | 객체 키 정책(프리픽스 등) |
| `qd_media_cache_control` | `public, max-age=31536000, immutable` | PUT 캐시 헤더 |

## 함정 (실사 기록)

- SigV4 의 host 서명은 전송 Host 헤더와 **바이트 일치** — 비표준 포트 포함(로컬 MinIO :9000).
- S3 DELETE 는 부재 키에도 2xx — 멱등.
