// readiness Route Handler — 앱이 떠서 요청을 수용할 준비가 됐음을 증명한다(ADR-0018). k8s
// readinessProbe 가 이 경로를 문다. **DB 는 부르지 않는다**: postgres 는 모든 파드가 공유하는 단일
// 외부 의존이라, 죽으면 replica 를 아무리 늘려도 전부 무력 → readiness 로 게이팅하면 라우팅할 곳
// 없이 부분 저하를 전면 503 으로 키우고(replicas:1), 롤아웃을 wedge 한다. DB 진실은 /api/status(admin)
// 와 주기 알림이 드러낸다. 매 요청 평가되도록 동적.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ ready: true });
}
