import { Pool } from "pg";

// 앱 전역 postgres 풀 (이슈 #6). 지금은 better-auth 어댑터가 쓰고,
// V2 의 /api/progress Route Handler 가 같은 풀을 재사용한다(ADR-0003).
//
// connectionString 이 undefined(컨테이너 빌드 시점엔 env 없음)여도 Pool 생성만으론
// 접속하지 않는다 — 첫 쿼리에서 비로소 연결한다. 그래서 import 는 항상 안전하다.
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
