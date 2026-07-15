"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { useExam } from "@/lib/exam-context";
import AdminEditLink from "@/components/AdminEditLink";

export default function Diagrams() {
  const { diagrams } = useExam();
  const [cat, setCat] = useState("전체");

  const cats = useMemo(
    () => ["전체", ...new Set(diagrams.map((d) => d.cat))],
    [diagrams],
  );

  const list = useMemo(
    () => diagrams.filter((d) => cat === "전체" || d.cat === cat),
    [diagrams, cat],
  );

  return (
    <div>
      {/* 카테고리 칩 */}
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

      {/* 개수 */}
      <div className="mb-4 text-sm text-[var(--muted)]">
        다이어그램 {list.length}개
      </div>

      {/* 카드 목록 */}
      <div className="space-y-5">
        {list.map((d) => (
          <Card key={d.id} padding={5}>
            <div className="mb-2 flex items-start justify-between gap-3">
              <h3 className="text-[15px] font-bold text-[var(--accent)]">
                {d.title}
              </h3>
              <span className="flex shrink-0 items-center gap-2">
                <AdminEditLink wpId={d.wpId} />
                <span className="rounded bg-[var(--panel-2)] px-2 py-0.5 text-xs text-[var(--muted)]">{d.cat}</span>
              </span>
            </div>

            {d.caption && (
              <p className="mb-3 text-sm leading-relaxed text-[var(--muted)]">
                {d.caption}
              </p>
            )}

            {d.image ? (
              // 래스터 다이어그램 — SVG 의 대안(WP 대표이미지 → R2). 게이트가 둘 중 하나를 보장.
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
