import Link from "next/link";
import { requireLearnerPage } from "@/lib/route-guards";
import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";
import { pool } from "@/lib/db";
import { listCollections } from "@/lib/collection-db";
import { groupItemsByExam } from "@/lib/collection";
import CreateCollection from "@/components/collections/CreateCollection";

// 내 컬렉션 목록 (ADR-0022 S1.5). /me 계열 — RSC 가 세션 Learner 로 스코프해 DB 직접 조회(/me 와
// 같은 패턴, 새 API 왕복 없음). 생성은 클라이언트 잎(CreateCollection → PUT → refresh).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function CollectionsPage() {
  const session = await requireLearnerPage();
  const cols = await listCollections(pool, session.user.id);

  return (
    <Container size="sm" className="py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">내 컬렉션</h1>
        <Link
          href="/me"
          className="flex min-h-[44px] items-center text-sm text-[var(--muted)] hover:text-[var(--fg)]"
        >
          ‹ 마이페이지
        </Link>
      </div>

      <CreateCollection />

      <ul className="mt-6 space-y-2">
        {cols.map((c) => {
          const examCount = groupItemsByExam(c.items).length;
          return (
            <li key={c.id}>
              <Link href={`/me/collections/${c.id}`} className="block">
                <Card padding={4} interactive>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{c.name}</div>
                      <div className="mt-0.5 text-xs text-[var(--muted)]">
                        문항 {c.items.length}개 · 시험 {examCount}개
                      </div>
                    </div>
                    <span className="shrink-0 text-sm text-[var(--muted)]">›</span>
                  </div>
                </Card>
              </Link>
            </li>
          );
        })}
        {cols.length === 0 && (
          <li className="rounded-lg border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--muted)]">
            아직 컬렉션이 없습니다 — 위에서 만들거나, 내 문제함에서 &quot;컬렉션에 담기&quot;로 시작하세요.
          </li>
        )}
      </ul>
    </Container>
  );
}
