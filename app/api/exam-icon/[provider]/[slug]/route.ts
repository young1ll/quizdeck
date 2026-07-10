import { pool } from "@/lib/db";
import { getIconImage } from "@/lib/exam-icon-db";

// 문제집 아이콘 이미지 서빙 (ADR-0023 애던덤). 공개 GET — 카탈로그(home)가 익명에게도 보이므로
// 아이콘도 공개다. URL 은 loadIconOverrides 가 ?v=updated_at 로 생성 → immutable 캐시 안전(교체
// 시 URL 이 바뀐다). nosniff + CSP default-src 'none' 으로 SVG 내 스크립트를 무력화한다(직접
// 내비게이션으로 열어도 실행 불가 — <img> 렌더는 원래 inert).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ provider: string; slug: string }> },
) {
  const { provider, slug } = await params;
  const row = await getIconImage(pool, `${provider}/${slug}`);
  if (!row) return new Response("not found", { status: 404 });
  return new Response(new Uint8Array(row.image), {
    headers: {
      "content-type": row.mime,
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'",
    },
  });
}
