"use client";

import { MODE_LABEL, useStore } from "@/lib/store";

export default function History() {
  const { store } = useStore();
  const sessions = store.sessions.slice().reverse();

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">📜 세션 히스토리</h1>
      {sessions.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">아직 완료한 세션이 없습니다.</p>
      ) : (
        <ul className="space-y-2">
          {sessions.map((x, i) => {
            const pct = Math.round((x.ok / x.n) * 100);
            const col =
              pct >= 80 ? "var(--good)" : pct >= 60 ? "var(--warn)" : "var(--bad)";
            return (
              <li
                key={`${x.date}-${i}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm"
              >
                <span>
                  <span className="block text-xs text-[var(--muted)]">
                    {new Date(x.date).toLocaleString("ko")}
                  </span>
                  {MODE_LABEL[x.mode]} · {x.n}문항 · {Math.floor(x.sec / 60)}분
                </span>
                <b style={{ color: col }}>
                  {x.ok}/{x.n} ({pct}%)
                </b>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
