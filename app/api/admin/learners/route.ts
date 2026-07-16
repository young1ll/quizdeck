import { withServiceToken } from "@/lib/route-guards";
import { pool } from "@/lib/db";
import { searchLearnersWithAnnotations } from "@/lib/admin-annotation-db";

// wp-admin '회원 주석' 화면의 회원 검색 API (ADR-0027). annotations 와 리소스가 달라 파일 분리.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/admin/learners?q=<검색어> — 이메일/이름 부분일치(빈 q = 주석 많은 순 상위 50).
export const GET = withServiceToken(async (req) => {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  return Response.json(await searchLearnersWithAnnotations(pool, q));
});
