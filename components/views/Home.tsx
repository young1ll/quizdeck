"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { IconType } from "react-icons";
import { LuFlame, LuPause, LuBookOpen, LuMap, LuNetwork, LuFolderOpen } from "react-icons/lu";
import { Card } from "@/components/ui/Card";
import { PendingLink } from "@/components/ui/PendingLink";
import { useExam } from "@/lib/exam-context";
import { MODE_LABEL, useStore, type Mode } from "@/lib/store";
import { MODE_ICON } from "@/lib/mode-icons";
import AdminEditLink from "@/components/AdminEditLink";
import { today } from "@/lib/dates";
import { examView } from "@/lib/exam-view";
import { resumeInfo } from "@/lib/session";
import { Button } from "@/components/ui/Button";

// exam 허브 = 슬림 런처 (ADR-0012 결정 4·5). 이어하기 + 모드(1급) + 압축 현황 한 줄("현황 자세히" →
// /stats) + 두 묶음 네비(학습 자료 / 내 학습). per-exam 심화 통계·주제별 정답률·데이터 도구는 허브에서
// 빠져 /stats(슬라이스 D)로 이주한다 — 허브의 1급 시민은 "연습 시작·섹션 이동"이라 첫 화면을 스캔
// 가능하게 유지. 검색은 섹션이 아니라 도구라 맥락 헤더(슬라이스 C)로 승격 — 허브 카드에서 제거.
const MODES: Mode[] = ["study", "smart", "exam"];

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
  // per-exam 파생 지표는 뷰모델(lib/exam-view)에서. 조건부 return 위에서 계산해 hook 순서를 보존한다
  // (익명도 hook 호출, 값은 미사용 — 익명 store 는 빈 Progress).
  const view = useMemo(
    () => examView(store, questions, total, today()),
    [store, questions, total],
  );

  // 익명 방문자 — Progress 의존 요소(현황·내 학습) 대신 축약 + 로그인 CTA. 학습 자료 열람은 허용. (ADR-0004)
  if (!isLearner) return <AnonymousHome onStartMode={onStartMode} />;

  const resume = resumeInfo(store.active);

  return (
    <div className="space-y-6">
      <header>
        <span className="flex items-center gap-3">
          <Link href={`/${meta.provider}/`} className="text-xs text-[var(--muted)] hover:text-[var(--fg)]">
            {meta.providerName} ›
          </Link>
          <AdminEditLink wpId={meta.wpId} />
        </span>
        <div className="mt-1 font-mono text-xs text-[var(--accent)]">{meta.code}</div>
        <h1 className="mt-1 text-2xl font-bold leading-snug">{meta.name}</h1>
      </header>

      {/* 이어하기 배너 — astryx Card(warn 강조) + Button(이어하기 primary / 버리기 outline). ADR-0014 Phase 3. */}
      {resume && (
        <Card padding={4} emphasis="warn">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 text-sm">
              <LuPause className="size-4 shrink-0 text-[var(--warn)]" aria-hidden />
              진행 중: {MODE_LABEL[resume.mode]} {resume.position}/{resume.total}
            </span>
            <div className="flex gap-2">
              <Button variant="primary" size="sm" onClick={onResume}>
                이어하기
              </Button>
              <Button variant="outline" size="sm" onClick={onDiscard}>
                버리기
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* 압축 현황 한 줄 — 글랜스(숙련도·연속일·오늘 목표) + 심화는 /stats(슬라이스 D). 진도 스코프
          사다리: 허브=한 줄, /stats=심화. astryx Card 서피스. */}
      <Card padding={0}>
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span>
              숙련도 <b className="text-[var(--accent)]">{view.mastery}%</b>
            </span>
            <span className="inline-flex items-center gap-1 text-[var(--muted)]">
              <LuFlame className="size-3.5 text-[var(--warn)]" aria-hidden /> 연속 {view.streak}일
            </span>
            <span className="text-[var(--muted)]">
              오늘 {view.todayCount}/{view.goal}
            </span>
          </div>
          <Link
            href={`${base}/stats`}
            className="shrink-0 whitespace-nowrap text-xs text-[var(--muted)] hover:text-[var(--fg)]"
          >
            현황 자세히 ›
          </Link>
        </div>
      </Card>

      {/* 모드 — 1급 액션 */}
      <ModeGrid onStartMode={onStartMode} />

      {/* 두 묶음 네비: 학습 자료(참조) / 내 학습(복습) — 참조와 복습은 다른 과업이라 시각 분리(ADR-0012
          결정 5). 검색은 섹션 아님 → 맥락 헤더(슬라이스 C). */}
      <NavGroup title="학습 자료">
        <NavLink href={`${base}/concepts`} icon={LuBookOpen} label="개념" />
        <NavLink href={`${base}/map`} icon={LuMap} label="서비스맵" />
        <NavLink href={`${base}/diagrams`} icon={LuNetwork} label="다이어그램" />
      </NavGroup>

      <NavGroup title="내 학습">
        <NavLink href={`${base}/my-problems`} icon={LuFolderOpen} label="내 문제함" badge={view.mine} />
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
        <span className="flex items-center gap-3">
          <Link href={`/${meta.provider}/`} className="text-xs text-[var(--muted)] hover:text-[var(--fg)]">
            {meta.providerName} ›
          </Link>
          <AdminEditLink wpId={meta.wpId} />
        </span>
        <div className="mt-1 font-mono text-xs text-[var(--accent)]">{meta.code}</div>
        <h1 className="mt-1 text-2xl font-bold leading-snug">{meta.name}</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">문항 {questions.length}개</p>
      </header>

      <Card padding={5}>
        <p className="text-sm font-medium">로그인하고 학습을 시작하세요</p>
        <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
          진도·오답노트·즐겨찾기·메모가 기기 간 자동 동기화됩니다. 아래 학습 모드를 누르면 로그인 창이 열립니다.
        </p>
      </Card>

      {/* 학습 모드 — 누르면 로그인 게이트 */}
      <ModeGrid onStartMode={onStartMode} />

      {/* 학습 자료(익명 허용) — 내 학습은 Progress 의존이라 제외 */}
      <NavGroup title="학습 자료">
        <NavLink href={`${base}/concepts`} icon={LuBookOpen} label="개념" />
        <NavLink href={`${base}/map`} icon={LuMap} label="서비스맵" />
        <NavLink href={`${base}/diagrams`} icon={LuNetwork} label="다이어그램" />
      </NavGroup>
    </div>
  );
}

// 학습 모드 버튼 그리드 — Learner 허브와 익명 허브가 공유. 누르면 onStartMode(게이트 경유). 1급 액션이라
// astryx Button(outline, fullWidth)로 — 참조/복습 네비(NavLink=카드)와 시각 구분(액션 vs 내비). ADR-0014 Phase 3.
function ModeGrid({ onStartMode }: { onStartMode: (mode: Mode) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {MODES.map((m) => {
        const Icon = MODE_ICON[m];
        return (
          <Button
            key={m}
            variant="outline"
            fullWidth
            icon={<Icon className="size-4" />}
            onClick={() => onStartMode(m)}
          >
            {MODE_LABEL[m]}
          </Button>
        );
      })}
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

// 참조/복습 네비 타일 — PendingLink>astryx Card(muted 서피스, 클라이언트 내비 유지 + pending 딤·스피너).
// 아이콘=Lucide, 뱃지는 카운트 pill.
function NavLink({
  href,
  icon: Icon,
  label,
  badge,
}: {
  href: string;
  icon: IconType;
  label: string;
  badge?: number;
}) {
  return (
    <PendingLink href={href} className="block">
      <Card padding={0} variant="muted" interactive>
        <div className="flex min-h-[44px] items-center justify-center gap-2 p-3 text-sm">
          <Icon className="size-4 shrink-0 text-[var(--muted)]" aria-hidden />
          <span>{label}</span>
          {badge != null && badge > 0 && (
            <span className="rounded-full bg-[var(--panel)] px-1.5 py-0.5 text-xs text-[var(--muted)]">
              {badge}
            </span>
          )}
        </div>
      </Card>
    </PendingLink>
  );
}
