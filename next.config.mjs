/** @type {import('next').NextConfig} */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

const nextConfig = {
  // 정적 익스포트 — `next build` 결과가 out/ 에 순수 정적 파일로 생성됨.
  // Synology(Web Station/nginx 또는 도커)에서 out/ 폴더만 서빙하면 된다.
  output: 'export',
  images: { unoptimized: true },
  // 서브경로 배포 대비(루트 배포 시 비움). 예: NEXT_PUBLIC_BASE_PATH=/quizdeck
  basePath: basePath || undefined,
  // 정적 호스팅에서 /aws/sap-c02/ → /aws/sap-c02/index.html 매핑이 자연스럽도록
  trailingSlash: true,
};

export default nextConfig;
