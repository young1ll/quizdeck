"use client";

import { useEffect, useMemo, useState } from "react";
import { LuSearch, LuLink } from "react-icons/lu";
import { Card } from "@/components/ui/Card";
import { TextInput } from "@astryxdesign/core/TextInput";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import type { Concept } from "@/lib/types";
import { useExam } from "@/lib/exam-context";
import { useNav } from "@/lib/nav-context";
import Icon from "@/components/Icon";
import Markdown from "@/components/Markdown";

/** 검색 매칭용으로 마크다운 기호(* _ `)를 제거하고 소문자화 */
function normalize(text: string): string {
  return text.replace(/[*_`]/g, "").toLowerCase();
}

/** 한 개념의 검색 대상 문자열(원본 renderConcept 필터와 동일 필드 구성) */
function searchHaystack(c: Concept): string {
  return normalize(
    [
      c.svc,
      c.abbr ?? "",
      c.deff,
      c.key,
      c.when,
      c.trap,
      c.vs,
      c.detail ?? "",
    ].join(" "),
  );
}

export default function Concepts({ initialSeed = "" }: { initialSeed?: string }) {
  const { concepts } = useExam();
  const { studyOne } = useNav();

  const [cat, setCat] = useState<string>("전체");
  const [query, setQuery] = useState<string>(initialSeed);

  // 다른 화면(서비스맵 openConceptFor)에서 ?seed 로 넘어온 초기 검색어 — 라우트 prop 으로 받는다.
  // (ADR-0010 슬라이스 B: conceptSeed 컨텍스트 → 라우트 query). seed 가 바뀌면 검색어 적용.
  useEffect(() => {
    if (initialSeed) setQuery(initialSeed);
  }, [initialSeed]);

  // 카테고리 칩: ["전체", ...등장 카테고리(중복 제거, 등장 순서)]
  const cats = useMemo<string[]>(() => {
    const seen: string[] = [];
    for (const c of concepts) {
      if (!seen.includes(c.cat)) seen.push(c.cat);
    }
    return ["전체", ...seen];
  }, [concepts]);

  // 필터: 카테고리 → 검색어
  const list = useMemo<Concept[]>(() => {
    const q = query.toLowerCase().trim();
    let next = concepts.filter((c) => cat === "전체" || c.cat === cat);
    if (q) next = next.filter((c) => searchHaystack(c).includes(q));
    return next;
  }, [concepts, cat, query]);

  return (
    <div>
      {/* 카테고리 칩 */}
      <div className="mb-3 flex flex-wrap gap-2">
        {cats.map((c) => {
          const active = c === cat;
          return (
            <button
              key={c}
              type="button"
              onClick={() => setCat(c)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                active
                  ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] text-[var(--accent)]"
                  : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)]"
              }`}
            >
              {c}
            </button>
          );
        })}
      </div>

      {/* 검색 입력 — astryx TextInput(검색 아이콘, 라벨 숨김) */}
      <div className="mb-3">
        <TextInput
          label="서비스/개념 검색"
          isLabelHidden
          value={query}
          onChange={(v) => setQuery(v)}
          placeholder="서비스/개념 검색"
          startIcon={<LuSearch />}
        />
      </div>

      {/* 개수 */}
      <div className="mb-4 text-xs text-[var(--muted)]">{list.length}개 서비스</div>

      {/* 결과 */}
      {list.length === 0 ? (
        <EmptyState title="검색 결과가 없습니다" />
      ) : (
        <div className="space-y-4">
          {list.map((c, i) => (
            <ConceptCard key={`${c.svc}-${i}`} concept={c} onStudy={studyOne} />
          ))}
        </div>
      )}
    </div>
  );
}

function ConceptCard({
  concept: c,
  onStudy,
}: {
  concept: Concept;
  onStudy: (qn: number) => void;
}) {
  const rel = c.rel ?? [];
  const reln = c.reln ?? rel.length;
  const showAbbr = !!c.abbr && c.abbr !== c.svc;

  return (
    <Card padding={5}>
      {/* 헤더 */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Icon svc={c.svc} size={32} />
          <span className="font-bold text-[var(--accent)]">{c.svc}</span>
          {showAbbr && (
            <span className="rounded-full bg-[var(--panel-2)] px-2 py-0.5 text-xs text-[var(--muted)]">
              {c.abbr}
            </span>
          )}
        </div>
        <span className="shrink-0 rounded-full bg-[var(--panel-2)] px-2.5 py-1 text-xs text-[var(--muted)]">
          {c.cat}
        </span>
      </div>

      {/* 정의 */}
      <p className="md text-sm leading-relaxed">
        <Markdown text={c.deff} />
      </p>

      {/* 상세 */}
      {c.detail && (
        <p className="md mt-2 text-sm leading-relaxed text-[var(--muted)]">
          <Markdown text={c.detail} />
        </p>
      )}

      {/* 핵심/언제/함정/비교/비용 */}
      <dl className="mt-4 space-y-1.5 text-sm leading-relaxed">
        <Field label="핵심" labelClass="text-[var(--accent)]" text={c.key} />
        <Field label="언제" labelClass="text-[var(--accent)]" text={c.when} />
        <Field label="함정" labelClass="text-[var(--warn)]" text={c.trap} />
        <Field label="비교" labelClass="text-[var(--good)]" text={c.vs} />
        <Field label="비용" labelStyle={{ color: "#9a6dd7" }} text={c.cost ?? ""} />
      </dl>

      {/* 관련 문제 */}
      <div className="mt-4 border-t border-[var(--border)] pt-3 text-sm">
        {rel.length > 0 ? (
          <details>
            <summary className="flex cursor-pointer items-center gap-1.5 text-[var(--muted)] select-none">
              <LuLink className="size-3.5" aria-hidden /> 관련 문제 {reln}개 (클릭해서 펼치기)
            </summary>
            <div className="mt-2 flex flex-wrap gap-2">
              {rel.map((qn) => (
                <button
                  key={qn}
                  type="button"
                  onClick={() => onStudy(qn)}
                  className="rounded-lg border border-[var(--border)] bg-[var(--panel-2)] px-2.5 py-1 font-mono text-xs hover:border-[var(--accent)]"
                >
                  Q{qn}
                </button>
              ))}
            </div>
            {reln > rel.length && (
              <p className="mt-2 inline-flex items-center gap-1 text-xs text-[var(--muted)]">
                …외 {reln - rel.length}개는 <LuSearch className="size-3" aria-hidden />검색 활용
              </p>
            )}
          </details>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[var(--muted)]">
            <LuLink className="size-3.5" aria-hidden /> 관련 문제 없음 (개념 참고용)
          </span>
        )}
      </div>
    </Card>
  );
}

function Field({
  label,
  text,
  labelClass,
  labelStyle,
}: {
  label: string;
  text: string;
  labelClass?: string;
  labelStyle?: React.CSSProperties;
}) {
  return (
    <div className="flex gap-2">
      <dt className={`shrink-0 font-bold ${labelClass ?? ""}`} style={labelStyle}>
        {label}
      </dt>
      <dd className="md min-w-0">
        <Markdown text={text} />
      </dd>
    </div>
  );
}
