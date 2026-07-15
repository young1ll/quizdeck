"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { TextInput } from "@astryxdesign/core/TextInput";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import Markdown from "@/components/Markdown";
import ServiceIcon from "./ServiceIcon";
import AdminEditLink from "@/components/AdminEditLink";
import type { ProviderContent } from "@/lib/content-localize";

// provider 개념 목록 — 서비스맵과 같은 데이터의 목록형: 서비스(정체성) 아래 시험별 카드(노트).
export default function ProviderConcepts({ data }: { data: ProviderContent }) {
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return data.services
      .map((s) => ({
        service: s,
        cards: data.contents.flatMap((x) =>
          x.concepts
            .filter((c) => c.serviceIds?.includes(s.id))
            .map((c) => ({ examKey: x.examKey, code: x.code, svc: c.svc, slot: c.content.ko ?? Object.values(c.content)[0] })),
        ),
      }))
      .filter((r) => r.cards.length > 0)
      .filter((r) => !needle || r.service.name.toLowerCase().includes(needle) || (r.service.abbr ?? "").toLowerCase().includes(needle));
  }, [data, q]);

  return (
    <div className="space-y-4">
      <TextInput label="서비스 검색" isLabelHidden value={q} onChange={(v) => setQ(v)} placeholder="서비스 검색 (이름·약어)" />
      <div className="text-sm text-[var(--muted)]">서비스 {rows.length}개 (카드가 연결된 것만)</div>
      {rows.length === 0 ? (
        <EmptyState title="검색 결과가 없습니다" isCompact />
      ) : (
        rows.map(({ service, cards }) => (
          <Card key={service.id} padding={5}>
            <div className="mb-3 flex items-center gap-2">
              <ServiceIcon icon={service.icon} size={32} />
              <span className="font-bold text-[var(--accent)]">{service.name}</span>
              <span className="ml-auto shrink-0 rounded-full bg-[var(--panel-2)] px-2.5 py-1 text-xs text-[var(--muted)]">
                {service.cat || "기타"}
              </span>
            </div>
            <div className="space-y-3">
              {cards.map((card) => (
                <div key={`${card.examKey}:${card.svc}`} className="border-l-2 border-[var(--border)] pl-3">
                  <div className="mb-1 flex items-center gap-2 text-xs">
                    <span className="rounded bg-[var(--panel-2)] px-2 py-0.5 font-mono text-[var(--accent)]">{card.code}</span>
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
          </Card>
        ))
      )}
    </div>
  );
}
