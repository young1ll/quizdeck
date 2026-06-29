import Link from "next/link";
import { notFound } from "next/navigation";
import { loadExam } from "@/lib/content";
import ExamApp from "@/components/ExamApp";

// 콘텐츠(Question·Concept)가 DB 라(ADR-0005 A) 빌드타임 SSG 폐기 → ISR.
//  - generateStaticParams=[] : 빌드 시 어떤 Exam 도 프리렌더하지 않음 → 빌드는 DB 불필요.
//  - dynamicParams=true·revalidate : 첫 요청에 DB 에서 생성·캐시, revalidate 주기로 갱신.
//    어드민 편집(#27)은 revalidatePath 로 즉시 무효화한다.
// pg 어댑터는 node 런타임 필요(edge 불가).
export const runtime = "nodejs";
export const dynamicParams = true;
export const revalidate = 3600;

export function generateStaticParams() {
  return [];
}

export default async function ExamPage({
  params,
}: {
  params: Promise<{ provider: string; exam: string }>;
}) {
  const { provider, exam } = await params;
  const data = await loadExam(provider, exam);
  if (!data) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <nav className="mb-4">
        <Link
          href="/"
          className="text-sm text-[var(--muted)] hover:text-[var(--fg)]"
        >
          ← 시험 목록
        </Link>
      </nav>
      <ExamApp data={data} />
    </main>
  );
}
