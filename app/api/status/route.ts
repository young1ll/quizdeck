import { withAdmin } from "@/lib/route-guards";
import { getStatus } from "@/lib/health";

// 운영 진단 Route Handler — sha·data tier 도달성·uptime(ADR-0018 / admin 허브 ADR-0017 의 status 카드가
// 끌어온다). withAdmin 이 admin role 만 통과시킨다(미인증·비admin 균일 403 — 관리 표면 존재를 안
// 드러냄, 콘텐츠 API 와 같은 규칙). getStatus 가 checkDb 로 DB 를 찌르되 시크릿·접속정보·stack 은 절대
// 담지 않는다. DB 왕복이라 node 런타임·동적.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withAdmin(async () => {
  return Response.json(await getStatus());
});
