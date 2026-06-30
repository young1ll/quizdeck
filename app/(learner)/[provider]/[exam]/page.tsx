import { notFound } from "next/navigation";
import { loadExamLocalized } from "@/lib/content";
import ExamApp from "@/components/ExamApp";
import { Container } from "@/components/ui/Container";

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
  const data = await loadExamLocalized(provider, exam);
  if (!data) notFound();

  // 컨테이너·전역 home 복귀(로고)는 learner shell. 여기선 ExamApp 만(학습 view 의 라우팅 분해는
  // 슬라이스 B — 이번 슬라이스는 shell·container 까지).
  return (
    <Container className="py-6">
      <ExamApp data={data} />
    </Container>
  );
}
