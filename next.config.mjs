import { withPayload } from '@payloadcms/next/withPayload';

/** @type {import('next').NextConfig} */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

const nextConfig = {
  // Standalone 노드 서버 — `next build` 가 .next/standalone(자체 server.js) 을 생성.
  // app/api/* Route Handler(인증·동기화 API)의 토대다. 정적 export(out/) 폐기. (ADR-0003)
  output: 'standalone',
  // next/image 최적화에 sharp 런타임 의존을 들이지 않는다(이미지 미사용).
  images: { unoptimized: true },
  // 서브경로 배포 대비(루트 배포 시 비움). 예: NEXT_PUBLIC_BASE_PATH=/quizdeck
  basePath: basePath || undefined,
  // 기존 URL 형태(/aws/sap-c02/) 를 그대로 유지해 회귀를 막는다.
  trailingSlash: true,
  // 단, 자동 슬래시 리다이렉트는 끈다. trailingSlash:true 면 Next 가
  // `/api/auth/jwks` → 308 → `/api/auth/jwks/` 로 리다이렉트하는데, better-auth
  // 핸들러는 슬래시 없는 경로만 매칭해 404 가 된다(인증 전부 깨짐). skip 하면
  // 페이지·readiness probe(/api/health/)는 그대로 매칭되고 /api/auth/* 만 살아난다.
  skipTrailingSlashRedirect: true,
};

// withPayload — Payload embed(ADR-0024)에 필요한 웹팩/서버 external 설정을 얹는다.
export default withPayload(nextConfig);
