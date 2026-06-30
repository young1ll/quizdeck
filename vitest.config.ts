import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

// tsconfig 의 `@/*` 경로 별칭을 vitest 에서도 해석한다 — app/api/* Route Handler 처럼
// `@/lib/...` 를 쓰는 서버 모듈을 테스트가 그대로 import 할 수 있게.
const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // react() — .test.tsx 의 JSX 변환(C2·C3 의 jsdom 컴포넌트/hook 테스트). tsconfig 는 Next 빌드용
  // jsx:"preserve" 라 vitest 가 따로 변환해야 한다(테스트 전용 — Next 빌드엔 무관).
  plugins: [react()],
  resolve: {
    alias: [{ find: /^@\//, replacement: `${root}/` }],
  },
});
