import config from "@payload-config";
import {
  REST_DELETE,
  REST_GET,
  REST_OPTIONS,
  REST_PATCH,
  REST_POST,
  REST_PUT,
} from "@payloadcms/next/routes";

// Payload REST(admin UI 내부 호출용) — routes.api('/api/cms') 와 디렉토리 일치 (ADR-0024).
// 기존 /api/collections(학습자 컬렉션)·/api/auth(better-auth) 와 충돌하지 않는 배치.
// 서빙(3단계)은 REST 가 아니라 Local API 를 쓴다.

export const GET = REST_GET(config);
export const POST = REST_POST(config);
export const DELETE = REST_DELETE(config);
export const PATCH = REST_PATCH(config);
export const PUT = REST_PUT(config);
export const OPTIONS = REST_OPTIONS(config);
