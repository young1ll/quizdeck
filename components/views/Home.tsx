"use client";

import { useMemo, useRef } from "react";
import { useExam } from "@/lib/exam-context";
import { useNav } from "@/lib/nav-context";
import { MODE_LABEL, useStore, type Mode, type Store } from "@/lib/store";
import { streak, today } from "@/lib/dates";
import { StatTile } from "@/components/ui/StatTile";
import { topicStat } from "@/lib/session";
import { exportProgressPDF } from "@/lib/pdf";

const MODES: Mode[] = ["study", "smart", "exam", "wrong", "star"];
const MODE_ICON: Record<Mode, string> = {
  study: "📚",
  smart: "🧠",
  exam: "⏱️",
  wrong: "🔁",
  star: "⭐",
};

export default function Home({
  isLearner,
  onStartMode,
  onResume,
  onDiscard,
}: {
  isLearner: boolean;
  onStartMode: (mode: Mode) => void;
  onResume: () => void;
  onDiscard: () => void;
}) {
  const { questions, meta } = useExam();
  const { go } = useNav();
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

  const ts = useMemo(
    () => topicStat(questions, store.hist),
    [questions, store.hist],
  );
  const sortedTopics = useMemo(
    () =>
      Object.entries(ts).sort((a, b) => {
        const pa = a[1].seen ? a[1].ok / a[1].seen : 2;
        const pb = b[1].seen ? b[1].ok / b[1].seen : 2;
        return pa - pb;
      }),
    [ts],
  );

  // 익명 방문자 — Progress 의존 대시보드 대신 축약 + 로그인 CTA. 열람 nav 유지(히스토리 제외). (ADR-0004)
  if (!isLearner) return <AnonymousHome onStartMode={onStartMode} />;
  const weak = sortedTopics
    .filter(([, m]) => m.seen >= 3 && m.ok / m.seen < 0.7)
    .map(([t]) => t.replace(/^\S+\s/, ""))
    .slice(0, 3);

  const st = streak(store.days);
  const goal = store.prefs.goal;
  const todayCount = store.days[today()] ?? 0;

  const active = store.active;

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
        <h1 className="mt-1 text-2xl font-bold leading-snug">{meta.name}</h1>
      </header>

      {/* 이어하기 배너 */}
      {active && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--warn)]/40 bg-[var(--panel)] p-4">
          <span className="text-sm">
            ⏸️ 진행 중: {MODE_LABEL[active.mode]} {active.idx + 1}/
            {active.queue.length}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onResume}
              className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-fg)]"
            >
              이어하기
            </button>
            <button
              type="button"
              onClick={onDiscard}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm hover:border-[var(--bad)]"
            >
              버리기
            </button>
          </div>
        </div>
      )}

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

      {/* 모드 */}
      <ModeGrid onStartMode={onStartMode} />

      {/* 참고 뷰 네비 */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <NavBtn label="📖 개념" onClick={() => go("concept")} />
        <NavBtn label="🗺️ 서비스맵" onClick={() => go("map")} />
        <NavBtn label="📐 다이어그램" onClick={() => go("diagram")} />
        <NavBtn label="🔎 검색" onClick={() => go("search")} />
        <NavBtn label="📜 히스토리" onClick={() => go("history")} />
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
                  <div
                    className="h-full"
                    style={{ width: `${p < 0 ? 0 : p}%`, background: col }}
                  />
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

      {/* 도구 */}
      <div className="flex flex-wrap gap-2 text-sm">
        <Tool
          label="🖨️ 학습 리포트"
          onClick={() =>
            exportProgressPDF(questions, store, meta, stats.masteryPct, st)
          }
        />
        <Tool label="💾 백업" onClick={doBackup} />
        <Tool label="📥 복원" onClick={() => fileRef.current?.click()} />
        <Tool
          label="🗑️ 초기화"
          onClick={() => {
            if (
              confirm(
                "모든 기록(정답률·오답·즐겨찾기·메모·히스토리)을 지울까요?",
              )
            )
              resetAll();
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
  );
}

// 익명 방문자용 축약 홈 (이슈 #22 / ADR-0004): 모드 버튼(누르면 로그인 게이트) + 열람 nav +
// 로그인 CTA. Progress 의존 블록(숙련도·통계·도구·히스토리)은 익명에 의미 없어 숨긴다.
function AnonymousHome({ onStartMode }: { onStartMode: (mode: Mode) => void }) {
  const { meta, questions } = useExam();
  const { go } = useNav();
  return (
    <div className="space-y-6">
      <header>
        <div className="font-mono text-xs text-[var(--accent)]">{meta.code}</div>
        <h1 className="mt-1 text-2xl font-bold leading-snug">{meta.name}</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">문항 {questions.length}개</p>
      </header>

      <div className="rounded-panel border border-[var(--border)] bg-[var(--panel)] p-5">
        <p className="text-sm font-medium">로그인하고 학습을 시작하세요</p>
        <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
          진도·오답노트·즐겨찾기·메모가 기기 간 자동 동기화됩니다. 아래 학습 모드를 누르면 로그인 창이 열립니다.
        </p>
      </div>

      {/* 학습 모드 — 누르면 로그인 게이트 */}
      <ModeGrid onStartMode={onStartMode} />

      {/* 열람(익명 허용) — 히스토리는 Progress 의존이라 제외 */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <NavBtn label="📖 개념" onClick={() => go("concept")} />
        <NavBtn label="🗺️ 서비스맵" onClick={() => go("map")} />
        <NavBtn label="📐 다이어그램" onClick={() => go("diagram")} />
        <NavBtn label="🔎 검색" onClick={() => go("search")} />
      </div>
    </div>
  );
}

// 학습 모드 버튼 그리드 — Learner 홈과 익명 홈이 공유. 누르면 onStartMode(게이트 경유).
function ModeGrid({ onStartMode }: { onStartMode: (mode: Mode) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {MODES.map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onStartMode(m)}
          className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-3 text-sm font-medium hover:border-[var(--accent)]"
        >
          {MODE_ICON[m]} {MODE_LABEL[m]}
        </button>
      ))}
    </div>
  );
}

function NavBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-[var(--border)] bg-[var(--panel-2)] p-3 text-sm hover:border-[var(--accent)]"
    >
      {label}
    </button>
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
