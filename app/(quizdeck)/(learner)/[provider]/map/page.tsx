import Link from "next/link";
import { notFound } from "next/navigation";
import ProviderMap from "@/components/views/provider/ProviderMap";
import { loadProviderContentCms } from "@/cms/serve";

// provider 서비스맵 — 정적 세그먼트가 [exam] 동적 세그먼트에 우선(exam slug 예약어 게이트가
// 충돌을 원천 차단 — WP save.php). ISR + 웹훅 revalidate.
// generateStaticParams 없인 revalidate 가 무시되고 ƒ Dynamic 으로 떨어진다(매 요청 ~3.4s 풀 렌더
// 실측·prefetch 불능) — 빈 배열로 온디맨드 ISR 게이트를 연다(exam layout 과 동일 패턴).
export const revalidate = 3600;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

export default async function ProviderMapPage({ params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const data = await loadProviderContentCms(provider);
  if (!data) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <Link
        href={`/${provider}`}
        className="mb-4 inline-flex min-h-[44px] items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--fg)]"
      >
        ← {data.providerName}
      </Link>
      <h1 className="mb-6 text-2xl font-bold">서비스맵</h1>
      <ProviderMap data={data} />
    </div>
  );
}
