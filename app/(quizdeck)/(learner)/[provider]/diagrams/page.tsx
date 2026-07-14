import Link from "next/link";
import { notFound } from "next/navigation";
import ProviderDiagrams from "@/components/views/provider/ProviderDiagrams";
import { loadProviderContentCms } from "@/cms/serve";

export const revalidate = 3600;

export default async function ProviderDiagramsPage({ params }: { params: Promise<{ provider: string }> }) {
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
      <h1 className="mb-6 text-2xl font-bold">다이어그램</h1>
      <ProviderDiagrams data={data} />
    </div>
  );
}
