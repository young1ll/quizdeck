import { redirect } from "next/navigation";

// 히스토리는 /stats 로 흡수됨 (ADR-0012 결정 7) — 지난 시도·세션은 per-exam 심화의 일부지 별도 라우트가
// 아니다. 기존 링크·북마크를 깨지 않게 /stats 로 리다이렉트한다.
export default async function HistoryPage({
  params,
}: {
  params: Promise<{ provider: string; exam: string }>;
}) {
  const { provider, exam } = await params;
  redirect(`/${provider}/${exam}/stats`);
}
