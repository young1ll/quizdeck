import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/Card";
import ExamIcon from "@/components/ui/ExamIcon";
import { listExamsCms } from "@/cms/serve";
import { groupExams } from "@/lib/catalog";

// provider 허브 (계층 실체화 — 결정 (a), 2026-07-14). aws > 트랙 > 시험 서열의 provider 층:
// 학습 자료(서비스맵·개념·다이어그램 — 레지스트리 앵커 집계) + 트랙 섹션별 시험 카드.
// ISR — 편집 웹훅이 provider 경로도 revalidate 한다(/api/revalidate-content).
export const revalidate = 3600;

const MATERIALS = [
  { href: "map", label: "서비스맵", desc: "서비스 레지스트리 — 시험별 노트로 연결" },
  { href: "concepts", label: "개념", desc: "서비스별 개념 카드 목록" },
  { href: "diagrams", label: "다이어그램", desc: "소속 시험 다이어그램 모음" },
] as const;

export default async function ProviderHub({ params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const exams = (await listExamsCms()).filter((e) => e.provider === provider);
  if (!exams.length) notFound();
  const groups = groupExams(exams);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <header className="mb-8">
        <h1 className="text-2xl font-bold leading-snug">{exams[0].providerName}</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">시험 {exams.length}개 · 학습 자료</p>
      </header>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">학습 자료</h2>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {MATERIALS.map((m) => (
            <li key={m.href}>
              <Link href={`/${provider}/${m.href}/`} className="block">
                <Card padding={4} interactive>
                  <div className="font-medium">{m.label}</div>
                  <div className="mt-1 text-xs text-[var(--muted)]">{m.desc}</div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="space-y-8">
        {groups.map((g) => (
          <section key={g.id}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">{g.name}</h2>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {g.exams.map((e) => (
                <li key={`${e.provider}/${e.slug}`}>
                  <Link href={`/${e.provider}/${e.slug}/`} className="block">
                    <Card padding={4} interactive>
                      <div className="font-mono text-xs text-[var(--accent)]">
                        <ExamIcon icon={e.icon} className="mr-1" />
                        {e.code}
                      </div>
                      <div className="mt-1 font-medium leading-snug">{e.name}</div>
                      <div className="mt-2 text-xs text-[var(--muted)]">문항 {e.questionCount}개</div>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
