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
};

export default nextConfig;
