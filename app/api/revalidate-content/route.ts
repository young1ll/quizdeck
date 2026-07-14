import { revalidatePath } from "next/cache";

// WP 편집 웹훅 수신 (ADR-0025 3단계) — quizdeck-content/webhook.php 가 게시본 영향 변화 시
// { examKey } 를 쏜다(클러스터 내부 + 공유 토큰). exam 레이아웃(ISR 3600)을 layout 스코프로
// 무효화. 토큰 불일치·미설정은 균일 401(관리 표면 존재를 안 드러냄 — withAdmin 의 403 규율과
// 같은 결).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const expected = process.env.REVALIDATE_TOKEN;
  if (!expected || req.headers.get("x-qd-token") !== expected) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as { examKey?: string; scope?: string } | null;
  // scope=site — 사이트 설정(태그라인·공지) 저장: 전 화면에 영향, 루트 layout 통째 무효화.
  if (body?.scope === "site") {
    revalidatePath("/", "layout");
    return Response.json({ revalidated: "site" });
  }
  const examKey = body?.examKey;
  if (typeof examKey !== "string" || !/^[a-z0-9-]+\/[a-z0-9-]+$/.test(examKey)) {
    return Response.json({ error: "examKey 형식 오류" }, { status: 400 });
  }
  revalidatePath(`/${examKey}`, "layout");
  return Response.json({ revalidated: examKey });
}
