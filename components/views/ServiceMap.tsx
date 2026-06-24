"use client";

import { useMemo, useState } from "react";
import type { Concept } from "@/lib/types";
import { useExam } from "@/lib/exam-context";
import { useNav } from "@/lib/nav-context";
import Icon from "@/components/Icon";

/** 검색 매칭용으로 마크다운 기호(* _ `)를 제거하고 소문자화 */
function normalize(text: string): string {
  return text.replace(/[*_`]/g, "").toLowerCase();
}

/**
 * 한 서비스의 검색 대상 문자열(원본 renderMap 필터와 동일 필드 구성):
 * svc + abbr + deff + key + vs
 */
function searchHaystack(c: Concept): string {
  return normalize([c.svc, c.abbr ?? "", c.deff, c.key, c.vs].join(" "));
}

interface CatGroup {
  cat: string;
  items: Concept[];
}

export default function ServiceMap() {
  const { concepts } = useExam();
  const { openConceptFor } = useNav();

  const [query, setQuery] = useState<string>("");

  // 카테고리별 그룹화(첫 등장 순서 유지)
  const groups = useMemo<CatGroup[]>(() => {
    const order: string[] = [];
    const map = new Map<string, Concept[]>();
    for (const c of concepts) {
      if (!map.has(c.cat)) {
        map.set(c.cat, []);
        order.push(c.cat);
      }
      map.get(c.cat)!.push(c);
    }
    return order.map((cat) => ({ cat, items: map.get(cat)! }));
  }, [concepts]);

  const q = query.toLowerCase().trim();

  return (
    <div>
      {/* 검색 입력 */}
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="서비스 검색"
        className="mb-4 w-full rounded-xl border border-[var(--border)] bg-[var(--panel)] px-4 py-2 text-sm outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent)]"
      />

      <div className="space-y-6">
        {groups.map((group) => (
          <section key={group.cat}>
            {/* 카테고리 헤더 */}
            <div className="mb-2 flex items-center gap-2">
              <h2 className="text-sm font-bold text-[var(--accent)]">
                {group.cat}
              </h2>
              <span className="rounded-full bg-[var(--panel-2)] px-2 py-0.5 text-xs text-[var(--muted)]">
                {group.items.length}
              </span>
            </div>

            {/* 서비스 타일 그리드 */}
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
              {group.items.map((c) => {
                const hit = q !== "" && searchHaystack(c).includes(q);
                let cls =
                  "rounded-xl border border-[var(--border)] bg-[var(--panel-2)] p-2 transition hover:border-[var(--accent)]";
                if (q !== "") {
                  cls += hit
                    ? " border-[var(--accent)] shadow-[0_0_0_1px_var(--accent),0_0_12px_-2px_var(--accent)]"
                    : " opacity-30";
                }
                return (
                  <button
                    key={c.svc}
                    type="button"
                    title={c.svc}
                    onClick={() => openConceptFor(c.svc)}
                    className={`flex flex-col items-center gap-1.5 text-center ${cls}`}
                  >
                    <Icon svc={c.svc} size={46} />
                    <span className="w-full break-words text-xs leading-tight text-[var(--muted)]">
                      {c.svc}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
