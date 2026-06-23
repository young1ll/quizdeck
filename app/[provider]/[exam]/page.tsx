import Link from "next/link";
import { listExams, loadExam } from "@/lib/content";
import QuizApp from "@/components/QuizApp";

// 정적 익스포트: 빌드 시 모든 시험 경로를 생성
export function generateStaticParams() {
  return listExams().map((e) => ({ provider: e.provider, exam: e.slug }));
}

export const dynamicParams = false;

export default async function ExamPage({
  params,
}: {
  params: Promise<{ provider: string; exam: string }>;
}) {
  const { provider, exam } = await params;
  // dynamicParams=false 이므로 generateStaticParams가 만든 경로만 빌드된다 → 항상 성공
  const data = loadExam(provider, exam);

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
      <QuizApp meta={data.meta} questions={data.questions} />
    </main>
  );
}
