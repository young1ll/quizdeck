"use client";

import { useMemo, useState } from "react";
import { LuSearch } from "react-icons/lu";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useExam } from "@/lib/exam-context";
import { useStore } from "@/lib/store";
import { useNav } from "@/lib/nav-context";
import type { Question } from "@/lib/types";

const MAX_RESULTS = 60;

export default function Search() {
  const { questions } = useExam();
  const { store } = useStore();
  const { studyOne } = useNav();

  const [query, setQuery] = useState("");

  const results = useMemo<Question[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    if (/^\d+$/.test(q)) {
      return questions
        .filter((d) => String(d.qn).startsWith(q))
        .slice(0, MAX_RESULTS);
    }
    return questions
      .filter((d) =>
        (
          d.q +
          " " +
          Object.values(d.options).join(" ") +
          " " +
          d.topic
        )
          .toLowerCase()
          .includes(q),
      )
      .slice(0, MAX_RESULTS);
  }, [query, questions]);

  const empty = query.trim() === "";

  return (
    <div>
      <TextInput
        label="문항 번호 또는 키워드 검색"
        isLabelHidden
        value={query}
        onChange={(v) => setQuery(v)}
        placeholder="문항 번호 또는 키워드 검색"
        startIcon={<LuSearch />}
        hasAutoFocus
      />

      <p className="mt-3 text-sm text-[var(--muted)]">
        {empty
          ? "번호 또는 키워드를 입력하세요"
          : `${results.length}건${results.length >= MAX_RESULTS ? "+ (상위 60)" : ""}`}
      </p>

      <ul className="mt-3 space-y-2">
        {results.map((d) => {
          const h = store.hist[d.qn];
          const mark = h ? (h.last === "O" ? "✅" : "❌") : "";
          const preview =
            d.q.length > 120 ? d.q.slice(0, 120) + "…" : d.q;
          return (
            <li key={d.qn}>
              <button
                type="button"
                onClick={() => studyOne(d.qn)}
                className="w-full cursor-pointer rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-left text-sm hover:border-[var(--accent)]"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[var(--muted)]">Q{d.qn}</span>
                  <span>· {d.topic}</span>
                  {mark && <span>{mark}</span>}
                </div>
                <p className="mt-1 line-clamp-2 text-[var(--muted)]">
                  {preview}
                </p>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
