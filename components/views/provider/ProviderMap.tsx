"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import Markdown from "@/components/Markdown";
import ServiceIcon from "./ServiceIcon";
import AdminEditLink from "@/components/AdminEditLink";
import type { ProviderContent } from "@/lib/content-localize";

// provider 서비스맵 (결정 (a) — 레지스트리 앵커 집계). 타일 = 서비스(정체성), 클릭하면 그
// 서비스를 참조하는 **시험별 개념 카드**(눈높이별 노트)가 나란히 — 2층 도메인 모델의 화면형.
export default function ProviderMap({ data }: { data: ProviderContent }) {
  const [selected, setSelected] = useState<string | null>(null);

  const byCat = useMemo(() => {
    const m = new Map<string, ProviderContent["services"]>();
    for (const s of data.services) {
      const cat = s.cat || "기타";
      m.set(cat, [...(m.get(cat) ?? []), s]);
    }
    return [...m.entries()];
  }, [data.services]);

  const cardsFor = (serviceId: string) =>
    data.contents.flatMap((x) =>
      x.concepts
        .filter((c) => c.serviceIds?.includes(serviceId))
        .map((c) => ({ examKey: x.examKey, code: x.code, svc: c.svc, slot: c.content.ko ?? Object.values(c.content)[0] })),
    );

  const selectedSvc = data.services.find((s) => s.id === selected);

  return (
    <div className="space-y-6">
      {byCat.map(([cat, services]) => (
        <section key={cat}>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">{cat}</h2>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
            {services.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelected(selected === s.id ? null : s.id)}
                className={`flex min-h-[88px] flex-col items-center justify-center gap-1.5 rounded-xl border p-2 text-center transition-colors ${
                  selected === s.id
                    ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]"
                    : "border-[var(--border)] hover:border-[var(--accent)]"
                }`}
              >
                <ServiceIcon icon={s.icon} size={40} />
                <span className="line-clamp-2 text-xs leading-tight">{s.abbr || s.name}</span>
              </button>
            ))}
          </div>

          {/* 선택 서비스의 시험별 카드 — 해당 분류 섹션 아래에 인라인 확장 */}
          {selectedSvc && services.some((s) => s.id === selectedSvc.id) && (
            <Card padding={5} className="mt-3">
              <div className="mb-3 flex items-center gap-2">
                <ServiceIcon icon={selectedSvc.icon} size={32} />
                <span className="font-bold text-[var(--accent)]">{selectedSvc.name}</span>
                {selectedSvc.abbr && selectedSvc.abbr !== selectedSvc.name && (
                  <span className="rounded-full bg-[var(--panel-2)] px-2 py-0.5 text-xs text-[var(--muted)]">
                    {selectedSvc.abbr}
                  </span>
                )}
                <AdminEditLink wpId={selectedSvc.wpId} className="ml-auto" />
              </div>
              {cardsFor(selectedSvc.id).length === 0 ? (
                <p className="text-sm text-[var(--muted)]">아직 이 서비스를 다루는 개념 카드가 없습니다.</p>
              ) : (
                <div className="space-y-4">
                  {cardsFor(selectedSvc.id).map((card) => (
                    <div key={`${card.examKey}:${card.svc}`} className="border-l-2 border-[var(--border)] pl-3">
                      <div className="mb-1 flex items-center gap-2 text-xs">
                        <span className="rounded bg-[var(--panel-2)] px-2 py-0.5 font-mono text-[var(--accent)]">
                          {card.code}
                        </span>
                        <Link
                          href={`/${card.examKey}/concepts?seed=${encodeURIComponent(card.svc)}`}
                          className="text-[var(--muted)] hover:text-[var(--fg)]"
                        >
                          시험에서 자세히 →
                        </Link>
                        <AdminEditLink wpId={card.slot?.wpId} />
                      </div>
                      <p className="md text-sm leading-relaxed">
                        <Markdown text={card.slot?.deff ?? ""} />
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </section>
      ))}
    </div>
  );
}
