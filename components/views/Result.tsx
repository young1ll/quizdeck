"use client";

import { useExam } from "@/lib/exam-context";
import { useNav } from "@/lib/nav-context";
import { MODE_LABEL } from "@/lib/store";
import { setsEqual } from "@/lib/session";
import type { QuizController } from "@/lib/use-quiz";
import { exportResultPDF } from "@/lib/pdf";

export default function Result({ quiz, onHome }: { quiz: QuizController; onHome: () => void }) {
  const { byQn, meta } = useExam();
  const { studyOne } = useNav();
  const s = quiz.session;
  if (!s) return null;

  const Q = s.queue;
  const tt: Record<string, { n: number; ok: number }> = {};
  let okCount = 0;
  for (const qn of Q) {
    const d = byQn.get(qn)!;
    const a = s.answers[qn] ?? { sel: [], ok: false };
    const correct = a.ok !== undefined ? a.ok : setsEqual(a.sel, d.answer);
    if (correct) okCount++;
    tt[d.topic] = tt[d.topic] ?? { n: 0, ok: 0 };
    tt[d.topic].n++;
    if (correct) tt[d.topic].ok++;
  }
  const pct = Math.round((okCount / Q.length) * 100);
  const wrong = s._wrong ?? [];
  const sec = Math.round((Date.now() - s.start) / 1000);
  const scoreColor =
    pct >= 80 ? "var(--good)" : pct >= 60 ? "var(--warn)" : "var(--bad)";

  return (
    <div>
      <header className="mb-4 flex items-center justify-between">
        <div className="font-mono text-xs text-[var(--accent)]">
          {meta.code} · {MODE_LABEL[s.mode]} 결과
        </div>
        <button
          type="button"
          onClick={() => exportResultPDF(s, byQn, meta)}
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs hover:border-[var(--accent)]"
        >
          🖨️ PDF 내보내기
        </button>
      </header>

      <div className="rounded-panel border border-[var(--border)] bg-[var(--panel)] p-6 text-center">
        <div className="text-5xl font-bold" style={{ color: scoreColor }}>
          {okCount} / {Q.length}
        </div>
        <div className="mt-1 text-2xl font-semibold" style={{ color: scoreColor }}>
          {pct}%
        </div>
        <div className="mt-2 text-sm text-[var(--muted)]">
          소요 {Math.floor(sec / 60)}분 {sec % 60}초
          {s.exam &&
            (pct >= 75 ? " · 합격선(75%) 통과 🎉" : " · 합격선 75%")}
        </div>
      </div>

      {/* 주제별 */}
      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold text-[var(--muted)]">주제별</h2>
        <div className="space-y-2">
          {Object.entries(tt).map(([topic, m]) => {
            const p = Math.round((m.ok / m.n) * 100);
            const col =
              p < 60 ? "var(--bad)" : p < 80 ? "var(--warn)" : "var(--good)";
            return (
              <div key={topic} className="flex items-center gap-3 text-sm">
                <span className="w-32 shrink-0 truncate">{topic}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--panel-2)]">
                  <div
                    className="h-full"
                    style={{ width: `${p}%`, background: col }}
                  />
                </div>
                <span className="w-12 shrink-0 text-right text-[var(--muted)]">
                  {m.ok}/{m.n}
                </span>
                <span className="w-10 shrink-0 text-right" style={{ color: col }}>
                  {p}%
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* 오답 */}
      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold text-[var(--muted)]">
          틀린 문항 ({wrong.length})
        </h2>
        {wrong.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">없음 — 완벽합니다! 🎉</p>
        ) : (
          <ul className="space-y-1">
            {wrong.map((qn) => {
              const d = byQn.get(qn)!;
              const a = s.answers[qn];
              return (
                <li key={qn}>
                  <button
                    type="button"
                    onClick={() => studyOne(qn)}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-left text-sm hover:border-[var(--accent)]"
                  >
                    <div className="text-xs text-[var(--muted)]">
                      Q{qn} · {d.topic} · 정답 {d.answer.join(",")} / 내 선택{" "}
                      {(a && a.sel.join(",")) || "-"}
                    </div>
                    <div className="mt-0.5 line-clamp-2">{d.q.slice(0, 110)}…</div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="mt-6 flex gap-2">
        {wrong.length > 0 && (
          <button
            type="button"
            onClick={quiz.retryWrong}
            className="flex-1 rounded-xl bg-[var(--accent)] px-5 py-3 font-semibold text-[var(--accent-fg)]"
          >
            틀린 문제 다시
          </button>
        )}
        <button
          type="button"
          onClick={onHome}
          className="flex-1 rounded-xl border border-[var(--border)] px-5 py-3 font-semibold hover:border-[var(--accent)]"
        >
          홈으로
        </button>
      </div>
    </div>
  );
}
