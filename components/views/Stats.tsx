"use client";

import { useMemo, useRef } from "react";
import { useExam } from "@/lib/exam-context";
import { MODE_LABEL, useStore, type Store } from "@/lib/store";
import { streak, today } from "@/lib/dates";
import { topicStat } from "@/lib/session";
import { exportProgressPDF } from "@/lib/pdf";
import { StatTile } from "@/components/ui/StatTile";

// per-exam 심화 현황 — /stats (ADR-0012 결정 4·7·8). 진도 스코프 사다리의 "이 시험 심화": 숙련도·통계·
// 일일목표 · 주제별 정답률 · 세션 히스토리(흡수) · 데이터 도구. 허브 슬림화(슬라이스 B)로 허브에서 빠진
// 블록들이 여기로 모인다. store-backed(익명은 로컬, Learner 는 동기화) — 다른 참조 라우트와 같은 결.
export default function Stats() {
  const { questions, meta } = useExam();
  const { store, setPrefs, resetAll, replaceStore } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);

  const total = questions.length;
  const stats = useMemo(() => {
    const histKeys = Object.keys(store.hist);
    const mastered = histKeys.filter((q) => store.hist[+q].last === "O").length;
    const seen = histKeys.length;
    return {
      mastered,
      seen,
      masteryPct: total ? Math.round((mastered / total) * 100) : 0,
      acc: seen ? Math.round((mastered / seen) * 100) : 0,
    };
  }, [store.hist, total]);

  const ts = useMemo(() => topicStat(questions, store.hist), [questions, store.hist]);
  const sortedTopics = useMemo(
    () =>
      Object.entries(ts).sort((a, b) => {
        const pa = a[1].seen ? a[1].ok / a[1].seen : 2;
        const pb = b[1].seen ? b[1].ok / b[1].seen : 2;
        return pa - pb;
      }),
    [ts],
  );
  const weak = sortedTopics
    .filter(([, m]) => m.seen >= 3 && m.ok / m.seen < 0.7)
    .map(([t]) => t.replace(/^\S+\s/, ""))
    .slice(0, 3);

  const st = streak(store.days);
  const goal = store.prefs.goal;
  const todayCount = store.days[today()] ?? 0;
  const sessions = store.sessions.slice().reverse();

  const doBackup = () => {
    const blob = new Blob([JSON.stringify(store)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${meta.slug}-진행백업-${today()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const doImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const o = JSON.parse(String(r.result)) as Store;
        if (!o.hist) {
          alert("형식이 올바르지 않습니다.");
          return;
        }
        if (confirm("현재 기록을 가져온 데이터로 교체할까요?")) {
          replaceStore(o);
          alert("복원 완료");
        }
      } catch (x) {
        alert("읽기 실패: " + x);
      }
    };
    r.readAsText(f);
    e.target.value = "";
  };
  const setGoal = () => {
    const v = prompt("하루 목표 문항 수", String(goal));
    if (v && +v > 0) setPrefs({ goal: +v });
  };

  return (
    <div className="space-y-6">
      <header>
        <div className="font-mono text-xs text-[var(--accent)]">{meta.code}</div>
        <h1 className="mt-1 text-xl font-bold leading-snug">학습 현황</h1>
      </header>

      {/* 숙련도 + 통계 */}
      <div className="rounded-panel border border-[var(--border)] bg-[var(--panel)] p-5">
        <div className="flex items-center gap-5">
          <div
            className="grid h-24 w-24 shrink-0 place-items-center rounded-full"
            style={{
              background: `conic-gradient(var(--accent) ${stats.masteryPct}%, var(--panel-2) 0)`,
            }}
          >
            <div className="grid h-[76px] w-[76px] place-items-center rounded-full bg-[var(--panel)] text-xl font-bold">
              {stats.masteryPct}%
            </div>
          </div>
          <div className="grid flex-1 grid-cols-3 gap-3 text-center">
            <StatTile b={`${stats.seen}/${total}`} s="학습 문항" />
            <StatTile b={`${stats.acc}%`} s="정답률" />
            <StatTile b={store.wrong.length} s="오답" />
            <StatTile b={`🔥${st}`} s="연속일" />
            <StatTile b={store.stars.length} s="즐겨찾기" />
            <StatTile b={store.sessions.length} s="세션" />
          </div>
        </div>
        {/* 일일 목표 */}
        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between text-xs text-[var(--muted)]">
            <span>오늘 목표</span>
            <button type="button" onClick={setGoal} className="hover:text-[var(--fg)]">
              {todayCount} / {goal} 문항 ⚙️
            </button>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--panel-2)]">
            <div
              className="h-full bg-[var(--good)]"
              style={{ width: `${Math.min(100, goal ? (todayCount / goal) * 100 : 0)}%` }}
            />
          </div>
        </div>
      </div>

      {/* 주제별 정답률 */}
      <div className="rounded-panel border border-[var(--border)] bg-[var(--panel)] p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--muted)]">주제별 정답률</h2>
          {weak.length > 0 && (
            <span className="text-xs text-[var(--bad)]">약점: {weak.join(", ")}</span>
          )}
        </div>
        <div className="space-y-2">
          {sortedTopics.map(([topic, m]) => {
            const p = m.seen ? Math.round((m.ok / m.seen) * 100) : -1;
            const col =
              p < 0
                ? "var(--border)"
                : p < 60
                  ? "var(--bad)"
                  : p < 80
                    ? "var(--warn)"
                    : "var(--good)";
            return (
              <div key={topic} className="flex items-center gap-3 text-sm">
                <span className="w-32 shrink-0 truncate">{topic}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--panel-2)]">
                  <div className="h-full" style={{ width: `${p < 0 ? 0 : p}%`, background: col }} />
                </div>
                <span className="w-12 shrink-0 text-right text-[var(--muted)]">
                  {m.seen}/{m.n}
                </span>
                <span className="w-10 shrink-0 text-right" style={{ color: col }}>
                  {p < 0 ? "–" : p + "%"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 세션 히스토리 — 흡수(ADR-0012 결정 7). 별도 라우트 아님(/history → /stats 리다이렉트). */}
      <div className="rounded-panel border border-[var(--border)] bg-[var(--panel)] p-5">
        <h2 className="mb-3 text-sm font-semibold text-[var(--muted)]">📜 세션 히스토리</h2>
        {sessions.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">아직 완료한 세션이 없습니다.</p>
        ) : (
          <ul className="space-y-2">
            {sessions.map((x, i) => {
              const pct = Math.round((x.ok / x.n) * 100);
              const col = pct >= 80 ? "var(--good)" : pct >= 60 ? "var(--warn)" : "var(--bad)";
              return (
                <li
                  key={`${x.date}-${i}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2 text-sm"
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

      {/* 이 시험 데이터 — 리포트·백업·복원·초기화(파괴적). 허브 첫 화면에서 강등돼 여기로(ADR-0012 결정 8). */}
      <div className="rounded-panel border border-[var(--border)] bg-[var(--panel)] p-5">
        <h2 className="mb-3 text-sm font-semibold text-[var(--muted)]">이 시험 데이터</h2>
        <div className="flex flex-wrap gap-2 text-sm">
          <Tool
            label="🖨️ 학습 리포트"
            onClick={() => exportProgressPDF(questions, store, meta, stats.masteryPct, st)}
          />
          <Tool label="💾 백업" onClick={doBackup} />
          <Tool label="📥 복원" onClick={() => fileRef.current?.click()} />
          <Tool
            label="🗑️ 초기화"
            onClick={() => {
              if (confirm("모든 기록(정답률·오답·즐겨찾기·메모·히스토리)을 지울까요?")) resetAll();
            }}
          />
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            onChange={doImport}
            className="hidden"
          />
        </div>
      </div>
    </div>
  );
}

function Tool({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-[var(--border)] px-3 py-1.5 hover:border-[var(--accent)]"
    >
      {label}
    </button>
  );
}
