import { defineConfig } from "vitest/config";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

// tsconfig 의 `@/*` 경로 별칭을 vitest 에서도 해석한다 — app/api/* Route Handler 처럼
// `@/lib/...` 를 쓰는 서버 모듈을 테스트가 그대로 import 할 수 있게.
const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: [{ find: /^@\//, replacement: `${root}/` }],
  },
});
