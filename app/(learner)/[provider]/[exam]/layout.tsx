import { notFound } from "next/navigation";
import { loadExamLocalized } from "@/lib/content";
import { Container } from "@/components/ui/Container";
import ExamProviders from "@/components/ExamProviders";

// exam 섹션 레이아웃 (ADR-0010 슬라이스 B). 콘텐츠(Question·Concept)를 **1회** 로드해 ExamProviders
// 에 넘긴다 — 그 안의 lang·store·게이트·nav 상태가 하위 라우트(hub·참조 뷰)를 가로질러 유지된다
// (layout 은 자식 네비게이션에 re-render 되지 않음). 콘텐츠는 DB 라 ISR, pg 는 node 런타임.
export const runtime = "nodejs";
export const dynamicParams = true;
export const revalidate = 3600;

export function generateStaticParams() {
  return [];
}

export default async function ExamLayout({
  params,
  children,
}: {
  params: Promise<{ provider: string; exam: string }>;
  children: React.ReactNode;
}) {
  const { provider, exam } = await params;
  const data = await loadExamLocalized(provider, exam);
  if (!data) notFound();

  return (
    <Container className="py-6">
      <ExamProviders data={data}>{children}</ExamProviders>
    </Container>
  );
}
