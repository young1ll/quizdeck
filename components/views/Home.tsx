"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useExam } from "@/lib/exam-context";
import { MODE_LABEL, useStore, type Mode } from "@/lib/store";
import { streak, today } from "@/lib/dates";
import { myProblems } from "@/lib/progress";

// exam 허브 = 슬림 런처 (ADR-0012 결정 4·5). 이어하기 + 모드(1급) + 압축 현황 한 줄("현황 자세히" →
// /stats) + 두 묶음 네비(학습 자료 / 내 학습). per-exam 심화 통계·주제별 정답률·데이터 도구는 허브에서
// 빠져 /stats(슬라이스 D)로 이주한다 — 허브의 1급 시민은 "연습 시작·섹션 이동"이라 첫 화면을 스캔
// 가능하게 유지. 검색은 섹션이 아니라 도구라 맥락 헤더(슬라이스 C)로 승격 — 허브 카드에서 제거.
const MODES: Mode[] = ["study", "smart", "exam"];
const MODE_ICON: Record<Mode, string> = {
  study: "📚",
  smart: "🧠",
  exam: "⏱️",
  wrong: "🔁",
  star: "⭐",
  mine: "🗂️",
  memo: "📝",
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
  const { store } = useStore();
  const base = `/${meta.provider}/${meta.slug}`;

  const total = questions.length;
  const masteryPct = useMemo(() => {
    const mastered = Object.keys(store.hist).filter((q) => store.hist[+q].last === "O").length;
    return total ? Math.round((mastered / total) * 100) : 0;
  }, [store.hist, total]);

  // 익명 방문자 — Progress 의존 요소(현황·내 학습) 대신 축약 + 로그인 CTA. 학습 자료 열람은 허용. (ADR-0004)
  if (!isLearner) return <AnonymousHome onStartMode={onStartMode} />;

  const st = streak(store.days);
  const goal = store.prefs.goal;
  const todayCount = store.days[today()] ?? 0;
  const active = store.active;
  const mineCount = myProblems(store).length;

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
            ⏸️ 진행 중: {MODE_LABEL[active.mode]} {active.idx + 1}/{active.queue.length}
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

      {/* 압축 현황 한 줄 — 글랜스(숙련도·연속일·오늘 목표) + 심화는 /stats(슬라이스 D). 진도 스코프
          사다리: 허브=한 줄, /stats=심화. */}
      <div className="flex items-center justify-between gap-3 rounded-panel border border-[var(--border)] bg-[var(--panel)] px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span>
            숙련도 <b className="text-[var(--accent)]">{masteryPct}%</b>
          </span>
          <span className="text-[var(--muted)]">🔥 연속 {st}일</span>
          <span className="text-[var(--muted)]">
            오늘 {todayCount}/{goal}
          </span>
        </div>
        <Link
          href={`${base}/stats`}
          className="shrink-0 whitespace-nowrap text-xs text-[var(--muted)] hover:text-[var(--fg)]"
        >
          현황 자세히 ›
        </Link>
      </div>

      {/* 모드 — 1급 액션 */}
      <ModeGrid onStartMode={onStartMode} />

      {/* 두 묶음 네비: 학습 자료(참조) / 내 학습(복습) — 참조와 복습은 다른 과업이라 시각 분리(ADR-0012
          결정 5). 검색은 섹션 아님 → 맥락 헤더(슬라이스 C). */}
      <NavGroup title="학습 자료">
        <NavLink href={`${base}/concepts`} label="📖 개념" />
        <NavLink href={`${base}/map`} label="🗺️ 서비스맵" />
        <NavLink href={`${base}/diagrams`} label="📐 다이어그램" />
      </NavGroup>

      <NavGroup title="내 학습">
        <NavLink href={`${base}/my-problems`} label="🗂️ 내 문제함" badge={mineCount} />
      </NavGroup>
    </div>
  );
}

// 익명 방문자용 축약 허브 (이슈 #22 / ADR-0004): 모드 버튼(누르면 로그인 게이트) + 학습 자료 열람 +
// 로그인 CTA. Progress 의존 블록(현황·내 학습)은 익명에 의미 없어 숨긴다.
function AnonymousHome({ onStartMode }: { onStartMode: (mode: Mode) => void }) {
  const { meta, questions } = useExam();
  const base = `/${meta.provider}/${meta.slug}`;
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

      {/* 학습 자료(익명 허용) — 내 학습은 Progress 의존이라 제외 */}
      <NavGroup title="학습 자료">
        <NavLink href={`${base}/concepts`} label="📖 개념" />
        <NavLink href={`${base}/map`} label="🗺️ 서비스맵" />
        <NavLink href={`${base}/diagrams`} label="📐 다이어그램" />
      </NavGroup>
    </div>
  );
}

// 학습 모드 버튼 그리드 — Learner 허브와 익명 허브가 공유. 누르면 onStartMode(게이트 경유).
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

// 네비 묶음 — 라벨된 섹션 + 라우트 링크 그리드(hub-and-spoke, ADR-0010 슬라이스 B). 모바일 뒤로가기·딥링크.
function NavGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
        {title}
      </h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{children}</div>
    </section>
  );
}

function NavLink({ href, label, badge }: { href: string; label: string; badge?: number }) {
  return (
    <Link
      href={href}
      className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--panel-2)] p-3 text-sm hover:border-[var(--accent)]"
    >
      <span>{label}</span>
      {badge != null && badge > 0 && (
        <span className="rounded-full bg-[var(--panel)] px-1.5 py-0.5 text-xs text-[var(--muted)]">
          {badge}
        </span>
      )}
    </Link>
  );
}
