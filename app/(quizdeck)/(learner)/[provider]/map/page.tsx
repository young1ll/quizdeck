import Link from "next/link";
import { notFound } from "next/navigation";
import ProviderMap from "@/components/views/provider/ProviderMap";
import { loadProviderContentCms } from "@/cms/serve";

// provider 서비스맵 — 정적 세그먼트가 [exam] 동적 세그먼트에 우선(exam slug 예약어 게이트가
// 충돌을 원천 차단 — WP save.php). ISR + 웹훅 revalidate.
export const revalidate = 3600;

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
