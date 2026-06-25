import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

// better-auth 전 경로를 standalone 서버의 Route Handler 로 마운트한다 — 가입·로그인·
// 로그아웃·세션 해석·JWKS(GET /api/auth/jwks) 가 같은 오리진에서 처리되어,
// 세션 쿠키(Secure·HttpOnly·SameSite)가 별도 도메인 왕복 없이 유지된다. (이슈 #6)

// pg 어댑터는 node 런타임 필요(edge 불가). 매 요청 평가되도록 동적으로 둔다.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const { GET, POST } = toNextJsHandler(auth);
