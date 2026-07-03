"use client";

import { useMemo, useRef } from "react";
import { LuFlame, LuSettings2, LuHistory, LuFileText, LuDownload, LuUpload, LuTrash2 } from "react-icons/lu";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { useExam } from "@/lib/exam-context";
import { MODE_LABEL, useStore, type Store } from "@/lib/store";
import { today } from "@/lib/dates";
import { examView } from "@/lib/exam-view";
import { exportProgressPDF } from "@/lib/pdf";
import { StatTile } from "@/components/ui/StatTile";
import { Button } from "@/components/ui/Button";

// 주제 정답률 % → astryx ProgressBar variant(미학습=neutral·<60 error·<80 warning·그외 success).
const barVariant = (p: number): "neutral" | "error" | "warning" | "success" =>
  p < 0 ? "neutral" : p < 60 ? "error" : p < 80 ? "warning" : "success";

// per-exam 심화 현황 — /stats (ADR-0012 결정 4·7·8). 진도 스코프 사다리의 "이 시험 심화": 숙련도·통계·
// 일일목표 · 주제별 정답률 · 세션 히스토리(흡수) · 데이터 도구. 허브 슬림화(슬라이스 B)로 허브에서 빠진
// 블록들이 여기로 모인다. store-backed(익명은 로컬, Learner 는 동기화) — 다른 참조 라우트와 같은 결.
export default function Stats() {
  const { questions, meta } = useExam();
  const { store, setPrefs, resetAll, replaceStore } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);

  const total = questions.length;
  // 파생 지표는 per-exam 뷰모델(lib/exam-view)에서 — mastery·정답률(correct/attempts)·카운트·연속일·약한
  // 주제를 한 곳에서 결정적으로. 정답률은 /me(dashboard)와 같은 단일 정의(옛 mastered/seen 버그 수정).
  const view = useMemo(
    () => examView(store, questions, total, today()),
    [store, questions, total],
  );
  // 주제별 목록 표시 순서(약한 주제부터) — 순수 정렬만 뷰에.
  const sortedTopics = useMemo(
    () =>
      Object.entries(view.topics).sort((a, b) => {
        const pa = a[1].seen ? a[1].ok / a[1].seen : 2;
        const pb = b[1].seen ? b[1].ok / b[1].seen : 2;
        return pa - pb;
      }),
    [view.topics],
  );
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
    const v = prompt("하루 목표 문항 수", String(view.goal));
    if (v && +v > 0) setPrefs({ goal: +v });
  };

  return (
    <div className="space-y-6">
      <header>
        <div className="font-mono text-xs text-[var(--accent)]">{meta.code}</div>
        <h1 className="mt-1 text-xl font-bold leading-snug">학습 현황</h1>
      </header>

      {/* 숙련도 + 통계 — astryx Card. 도넛(conic-gradient)·StatTile 유지, 일일목표는 ProgressBar. */}
      <Card padding={5}>
        <div className="flex items-center gap-5">
          <div
            className="grid h-24 w-24 shrink-0 place-items-center rounded-full"
            style={{
              background: `conic-gradient(var(--accent) ${view.mastery}%, var(--panel-2) 0)`,
            }}
          >
            <div className="grid h-[76px] w-[76px] place-items-center rounded-full bg-[var(--panel)] text-xl font-bold">
              {view.mastery}%
            </div>
          </div>
          <div className="grid flex-1 grid-cols-3 gap-3 text-center">
            <StatTile b={`${view.seen}/${total}`} s="학습 문항" />
            <StatTile b={`${view.accuracy}%`} s="정답률" />
            <StatTile b={view.wrong} s="오답" />
            <StatTile
              b={
                <span className="inline-flex items-center justify-center gap-0.5">
                  <LuFlame className="size-4 text-[var(--warn)]" aria-hidden />
                  {view.streak}
                </span>
              }
              s="연속일"
            />
            <StatTile b={view.stars} s="즐겨찾기" />
            <StatTile b={store.sessions.length} s="세션" />
          </div>
        </div>
        {/* 일일 목표 — astryx ProgressBar(success). 목표 설정은 버튼(prompt). */}
        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between text-xs text-[var(--muted)]">
            <span>오늘 목표</span>
            <button
              type="button"
              onClick={setGoal}
              className="inline-flex items-center gap-1 hover:text-[var(--fg)]"
            >
              {view.todayCount} / {view.goal} 문항 <LuSettings2 className="size-3.5" aria-hidden />
            </button>
          </div>
          <ProgressBar
            value={Math.min(view.goal, view.todayCount)}
            max={view.goal || 1}
            label="오늘 목표 진행"
            isLabelHidden
            variant="success"
          />
        </div>
      </Card>

      {/* 주제별 정답률 — astryx Card + ProgressBar(정답률 임계값→variant). */}
      <Card padding={5}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--muted)]">주제별 정답률</h2>
          {view.weakTopics.length > 0 && (
            <span className="text-xs text-[var(--bad)]">약점: {view.weakTopics.join(", ")}</span>
          )}
        </div>
        <div className="space-y-2">
          {sortedTopics.map(([topic, m]) => {
            const p = m.seen ? Math.round((m.ok / m.seen) * 100) : -1;
            const variant = barVariant(p);
            return (
              <div key={topic} className="flex items-center gap-3 text-sm">
                <span className="w-32 shrink-0 truncate">{topic}</span>
                <ProgressBar
                  value={p < 0 ? 0 : p}
                  max={100}
                  label={`${topic} 정답률`}
                  isLabelHidden
                  variant={variant}
                  className="flex-1"
                />
                <span className="w-12 shrink-0 text-right text-[var(--muted)]">
                  {m.seen}/{m.n}
                </span>
                <span
                  className={`w-10 shrink-0 text-right ${
                    p < 0
                      ? "text-[var(--muted)]"
                      : p < 60
                        ? "text-[var(--bad)]"
                        : p < 80
                          ? "text-[var(--warn)]"
                          : "text-[var(--good)]"
                  }`}
                >
                  {p < 0 ? "–" : p + "%"}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* 세션 히스토리 — 흡수(ADR-0012 결정 7). 별도 라우트 아님(/history → /stats 리다이렉트). */}
      <Card padding={5}>
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-[var(--muted)]">
          <LuHistory className="size-4" aria-hidden /> 세션 히스토리
        </h2>
        {sessions.length === 0 ? (
          <EmptyState isCompact title="아직 완료한 세션이 없습니다" />
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
      </Card>

      {/* 이 시험 데이터 — 리포트·백업·복원·초기화(파괴적). 허브 첫 화면에서 강등돼 여기로(ADR-0012 결정 8).
          도구는 astryx Button(outline; 초기화=dangerOutline 파괴적 강조). */}
      <Card padding={5}>
        <h2 className="mb-3 text-sm font-semibold text-[var(--muted)]">이 시험 데이터</h2>
        <div className="flex flex-wrap gap-2 text-sm">
          <Button
            variant="outline"
            size="sm"
            icon={<LuFileText className="size-4" />}
            onClick={() => exportProgressPDF(questions, store, meta, view.mastery, view.streak)}
          >
            학습 리포트
          </Button>
          <Button variant="outline" size="sm" icon={<LuDownload className="size-4" />} onClick={doBackup}>
            백업
          </Button>
          <Button
            variant="outline"
            size="sm"
            icon={<LuUpload className="size-4" />}
            onClick={() => fileRef.current?.click()}
          >
            복원
          </Button>
          <Button
            variant="dangerOutline"
            size="sm"
            icon={<LuTrash2 className="size-4" />}
            onClick={() => {
              if (confirm("모든 기록(정답률·오답·즐겨찾기·메모·히스토리)을 지울까요?")) resetAll();
            }}
          >
            초기화
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            onChange={doImport}
            className="hidden"
          />
        </div>
      </Card>
    </div>
  );
}
