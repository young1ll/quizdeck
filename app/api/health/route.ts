// 헬스 체크 Route Handler — standalone 노드 런타임과 app/api/* 토대가
// 살아 있음을 증명한다(이슈 #3). 매 요청마다 평가되도록 동적으로 둔다.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ status: "ok" });
}
