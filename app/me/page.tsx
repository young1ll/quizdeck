import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import MyPage from "@/components/MyPage";

// 마이페이지 — Learner 허브(이슈 #36 / ADR-0006). 1차 슬라이스 = 계정 관리. requireEmailVerification
// 때문에 세션 존재 = 검증된 Learner 이므로, 세션이 없으면 홈으로 보낸다(익명·미인증 → 로그인 유도).
// 세션 의존이라 동적. pg(세션 조회)는 node 런타임.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function Me() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");
  return <MyPage name={session.user.name} email={session.user.email} />;
}
