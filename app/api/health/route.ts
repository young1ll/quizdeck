import { getVersion } from "@/lib/health";

// liveness Route Handler — standalone 노드 런타임과 app/api/* 토대가 살아 있음을 증명한다(이슈 #3).
// k8s livenessProbe·Docker HEALTHCHECK 가 이 경로를 문다. **DB 는 부르지 않는다**(ADR-0018): DB
// 순단으로 파드가 재시작되면 안 된다(캐스케이드 방지). build sha 를 함께 노출 — 배포 게이트가 클러스터
// 밖에서 기대 sha 를 폴링한다(공개 안전: 이미지 태그·git 이 이미 공개). 매 요청 평가되도록 동적.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ ok: true, ...getVersion() });
}
