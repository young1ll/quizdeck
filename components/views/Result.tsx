"use client";

import { LuFileDown, LuPartyPopper } from "react-icons/lu";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { useExam } from "@/lib/exam-context";
import { useNav } from "@/lib/nav-context";
import { MODE_LABEL } from "@/lib/store";
import type { QuizController } from "@/lib/use-quiz";
import { exportResultPDF } from "@/lib/pdf";
import { Button } from "@/components/ui/Button";

// 정답률 % → astryx ProgressBar variant (<60 error·<80 warning·그외 success).
const barVariant = (p: number): "error" | "warning" | "success" =>
  p < 60 ? "error" : p < 80 ? "warning" : "success";

export default function Result({ quiz, onHome }: { quiz: QuizController; onHome: () => void }) {
  const { byQn, meta } = useExam();
  const { studyOne } = useNav();
  // 컨트롤러가 finish 시 1회 계산한 결과를 읽는다 — 재채점하지 않는다(옛날엔 okCount·주제별·오답을 여기서
  // 다시 채점했다). 채점 규칙·집계는 lib/session(gradeAnswer·computeResult)에 단일 정의.
  const r = quiz.result;
  if (!r) return null;

  const scoreColor = r.pct >= 80 ? "var(--good)" : r.pct >= 60 ? "var(--warn)" : "var(--bad)";

  return (
    <div>
      <header className="mb-4 flex items-center justify-between">
        <div className="font-mono text-xs text-[var(--accent)]">
          {meta.code} · {MODE_LABEL[r.mode]} 결과
        </div>
        <Button
          variant="outline"
          size="sm"
          icon={<LuFileDown className="size-4" />}
          onClick={() => exportResultPDF(r, byQn, meta)}
        >
          PDF 내보내기
        </Button>
      </header>

      <Card padding={6}>
        <div className="text-center">
          <div className="text-5xl font-bold" style={{ color: scoreColor }}>
            {r.okCount} / {r.total}
          </div>
          <div className="mt-1 text-2xl font-semibold" style={{ color: scoreColor }}>
            {r.pct}%
          </div>
          <div className="mt-2 flex items-center justify-center gap-1 text-sm text-[var(--muted)]">
            <span>
              소요 {Math.floor(r.sec / 60)}분 {r.sec % 60}초
              {r.exam && (r.pct >= 75 ? " · 합격선(75%) 통과" : " · 합격선 75%")}
            </span>
            {r.exam && r.pct >= 75 && (
              <LuPartyPopper className="size-4 text-[var(--good)]" aria-hidden />
            )}
          </div>
        </div>
      </Card>

      {/* 주제별 */}
      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold text-[var(--muted)]">주제별</h2>
        <div className="space-y-2">
          {Object.entries(r.perTopic).map(([topic, m]) => {
            const p = Math.round((m.ok / m.n) * 100);
            return (
              <div key={topic} className="flex items-center gap-3 text-sm">
                <span className="w-32 shrink-0 truncate">{topic}</span>
                <ProgressBar
                  value={p}
                  max={100}
                  label={`${topic} 정답률`}
                  isLabelHidden
                  variant={barVariant(p)}
                  className="flex-1"
                />
                <span className="w-12 shrink-0 text-right text-[var(--muted)]">
                  {m.ok}/{m.n}
                </span>
                <span
                  className={`w-10 shrink-0 text-right ${
                    p < 60
                      ? "text-[var(--bad)]"
                      : p < 80
                        ? "text-[var(--warn)]"
                        : "text-[var(--good)]"
                  }`}
                >
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
          틀린 문항 ({r.wrong.length})
        </h2>
        {r.wrong.length === 0 ? (
          <p className="flex items-center gap-1 text-sm text-[var(--muted)]">
            없음 — 완벽합니다! <LuPartyPopper className="size-4 text-[var(--good)]" aria-hidden />
          </p>
        ) : (
          <ul className="space-y-1">
            {r.wrong.map(({ qn, sel }) => {
              const d = byQn.get(qn)!;
              return (
                <li key={qn}>
                  <button
                    type="button"
                    onClick={() => studyOne(qn)}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-left text-sm hover:border-[var(--accent)]"
                  >
                    <div className="text-xs text-[var(--muted)]">
                      Q{qn} · {d.topic} · 정답 {d.answer.join(",")} / 내 선택 {sel.join(",") || "-"}
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
        {r.wrong.length > 0 && (
          <Button variant="primary" className="flex-1" onClick={quiz.retryWrong}>
            틀린 문제 다시
          </Button>
        )}
        <Button variant="outline" className="flex-1" onClick={onHome}>
          홈으로
        </Button>
      </div>
    </div>
  );
}
