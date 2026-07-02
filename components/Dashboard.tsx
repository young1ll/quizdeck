import Link from "next/link";
import { LuFlame, LuFolderOpen } from "react-icons/lu";
import { Card } from "@astryxdesign/core/Card";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import type { DashboardData } from "@/lib/dashboard";
import { StatTile } from "@/components/ui/StatTile";

// 학습 현황 — /me 허브의 활동 섹션 (이슈 #37 / ADR-0006 결정 5 · ADR-0014 Phase 3). 서버에서 집계된 plain
// 데이터를 표시만 한다(서버 컴포넌트). 서피스는 astryx Card(외곽 panel + 시험 카드 muted=panel-2), 빈
// 상태는 EmptyState, 시험 카드는 Link>Card(클라이언트 내비 유지). meta 는 examKey → 표시 이름·코드·링크.
export default function Dashboard({
  data,
  meta,
}: {
  data: DashboardData;
  meta: Record<string, { name: string; code: string; href: string }>;
}) {
  return (
    <Card padding={5}>
      <h2 className="mb-3 text-sm font-semibold">학습 현황</h2>
      {data.totalExams === 0 ? (
        <EmptyState
          isCompact
          title="아직 학습 기록이 없어요"
          description="시험을 골라 학습을 시작하세요."
          actions={
            <Link href="/" className="text-sm text-[var(--accent)] hover:underline">
              시험 고르러 가기 →
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-4 gap-2 text-center">
            <StatTile b={data.totalExams} s="학습 시험" className="py-2" />
            <StatTile
              b={
                <span className="inline-flex items-center justify-center gap-0.5">
                  <LuFlame className="size-4 text-[var(--warn)]" aria-hidden />
                  {data.streak}
                </span>
              }
              s="연속일"
              className="py-2"
            />
            <StatTile b={data.totalSeen} s="학습 문항" className="py-2" />
            <StatTile b={data.totalMine} s="내 문제함" className="py-2" />
          </div>
          <ul className="mt-4 space-y-2">
            {data.exams.map((e) => {
              const m = meta[e.examKey];
              return (
                <li key={e.examKey}>
                  <Link href={m?.href ?? "/"} className="block">
                    <Card
                      padding={3}
                      variant="muted"
                      className="transition-colors hover:border-[var(--accent)]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          {m && (
                            <div className="font-mono text-[10px] text-[var(--accent)]">{m.code}</div>
                          )}
                          <div className="truncate text-sm font-medium">{m?.name ?? e.examKey}</div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-lg font-bold leading-none">{e.mastery}%</div>
                          <div className="mt-0.5 text-[10px] text-[var(--muted)]">숙련도</div>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
                        <span>
                          학습 {e.seen}/{e.total}
                        </span>
                        <span>정답률 {e.accuracy}%</span>
                        <span className="inline-flex items-center gap-1">
                          <LuFolderOpen className="size-3.5" aria-hidden /> 내 문제함 {e.mine}
                        </span>
                        <span>오답 {e.wrong}</span>
                        <span>즐겨찾기 {e.stars}</span>
                        {e.lastActiveDay && <span>최근 {e.lastActiveDay}</span>}
                      </div>
                    </Card>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Card>
  );
}
