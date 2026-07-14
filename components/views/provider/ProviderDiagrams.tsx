"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import type { ProviderContent } from "@/lib/content-localize";

// provider 다이어그램 — 소속 시험들의 합집합 + 출처 시험 배지(소유권 이동 없음 — 결정 (a)).
export default function ProviderDiagrams({ data }: { data: ProviderContent }) {
  const all = useMemo(
    () => data.contents.flatMap((x) => x.diagrams.map((d) => ({ ...d, code: x.code, examKey: x.examKey }))),
    [data.contents],
  );
  const [cat, setCat] = useState("전체");
  const cats = useMemo(() => ["전체", ...new Set(all.map((d) => d.cat))], [all]);
  const list = useMemo(() => all.filter((d) => cat === "전체" || d.cat === cat), [all, cat]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-2">
        {cats.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCat(c)}
            className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
              c === cat
                ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_15%,transparent)]"
                : "border-[var(--border)] hover:border-[var(--accent)]"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="mb-4 text-sm text-[var(--muted)]">다이어그램 {list.length}개</div>

      <div className="space-y-5">
        {list.map((d) => (
          <Card key={`${d.examKey}:${d.id}`} padding={5}>
            <div className="mb-2 flex items-start justify-between gap-3">
              <h3 className="text-[15px] font-bold text-[var(--accent)]">{d.title}</h3>
              <span className="flex shrink-0 items-center gap-1.5">
                <span className="rounded bg-[var(--panel-2)] px-2 py-0.5 font-mono text-xs text-[var(--accent)]">{d.code}</span>
                <span className="rounded bg-[var(--panel-2)] px-2 py-0.5 text-xs text-[var(--muted)]">{d.cat}</span>
              </span>
            </div>
            {d.caption && <p className="mb-3 text-sm leading-relaxed text-[var(--muted)]">{d.caption}</p>}
            {d.image ? (
              <div className="diagbox overflow-x-auto rounded-xl bg-white p-3">
                <img src={d.image} alt={d.title} loading="lazy" className="h-auto max-w-full" />
              </div>
            ) : (
              <div
                className="diagbox overflow-x-auto rounded-xl bg-white p-3 [&_svg]:h-auto [&_svg]:max-w-full"
                dangerouslySetInnerHTML={{ __html: d.svg ?? "" }}
              />
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
