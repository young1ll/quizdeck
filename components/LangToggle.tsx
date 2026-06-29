"use client";

import { useLang } from "@/lib/lang-context";
import { LANG_LABEL } from "@/lib/content-localize";

// 언어 토글 (이슈 #28 / ADR-0005 C). 가용 언어가 2개 이상일 때만 보인다(1개면 숨김).
// 전환은 표시 언어만 바꾼다 — qn·정답·Progress 는 그대로(언어 무관).
export default function LangToggle() {
  const { lang, setLang, available } = useLang();
  if (available.length < 2) return null;

  return (
    <div className="mb-3 flex gap-1 text-xs">
      {available.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={l === lang}
          className={
            "rounded-lg px-2.5 py-1 font-medium transition-colors " +
            (l === lang
              ? "bg-[var(--accent)] text-[var(--accent-fg)]"
              : "text-[var(--muted)] hover:text-[var(--fg)]")
          }
        >
          {LANG_LABEL[l] ?? l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
