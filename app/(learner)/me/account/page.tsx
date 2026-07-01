import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLearnerSession } from "@/lib/learner-server";
import { Container } from "@/components/ui/Container";
import MyPage from "@/components/MyPage";

// 계정 관리 (ADR-0012 결정 2·8 — /me 분리). 파괴적·저빈도 액션(탈퇴)을 회고 인덱스(/me)에서 격리한
// 전용 라우트. Learner 전용(익명·미인증 → 홈). 계정 작업은 User(인증 자격)에 작용 — 활동 Learner 와
// 구분되는 두 축(ADR-0006). 세션 의존이라 동적, node 런타임.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function Account() {
  const session = await getLearnerSession(await headers());
  if (!session) redirect("/");

  return (
    <Container size="sm" className="py-8">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/me"
          className="flex min-h-[44px] items-center text-sm text-[var(--muted)] hover:text-[var(--fg)]"
        >
          ‹ 마이페이지
        </Link>
      </div>
      <h1 className="mb-6 text-2xl font-bold">계정 관리</h1>
      <div className="space-y-5">
        <MyPage name={session.user.name} email={session.user.email} />
      </div>
    </Container>
  );
}
