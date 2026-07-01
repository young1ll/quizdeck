import { mastery, myProblems, type Progress } from "./progress";
import { streak } from "./dates";

// 학습 대시보드 집계 (이슈 #37 / ADR-0006 결정 5). client-safe(순수, no pg) — /me 서버 컴포넌트가
// 전 Exam Progress 를 모아 이 함수들로 집계하고, 테스트도 결정적이다. 한 Learner 의 여러 Exam
// Progress 를 가로질러 종합(streak·총 학습)과 Exam별 카드 통계를 낸다. mastery 등 도메인 도출은
// lib/progress 재사용 — Home 의 per-exam 통계와 같은 정의.

export interface ExamStat {
  examKey: string;
  total: number; // 문항 수(meta)
  seen: number; // 학습한(이력 있는) 문항 수
  mastery: number; // % — 마지막 정답 비율
  accuracy: number; // % — 전체 시도 중 정답
  wrong: number; // 오답노트 크기
  stars: number; // 즐겨찾기 수
  mine: number; // 내 문제함 크기(오답∪별표∪메모, ADR-0011)
  sessions: number; // 완료 세션 수
  lastActiveDay: string | null; // 'YYYY-MM-DD'(활동 일자 중 최신)
}

export interface DashboardData {
  exams: ExamStat[]; // 활동 있는 Exam 만, 최근 활동 desc
  totalExams: number;
  streak: number; // 전체 연속 학습일(전 Exam 합집합)
  totalSeen: number;
  totalWrong: number;
  totalStars: number;
  totalMine: number;
}

export function examStat(examKey: string, p: Progress, total: number): ExamStat {
  const hist = Object.values(p.hist);
  const attempts = hist.reduce((s, h) => s + h.seen, 0);
  const correct = hist.reduce((s, h) => s + h.correct, 0);
  const days = Object.keys(p.days);
  return {
    examKey,
    total,
    seen: hist.length,
    mastery: mastery(p, total),
    accuracy: attempts ? Math.round((correct / attempts) * 100) : 0,
    wrong: p.wrong.length,
    stars: p.stars.length,
    mine: myProblems(p).length,
    sessions: p.sessions.length,
    lastActiveDay: days.length ? days.slice().sort().at(-1)! : null,
  };
}

// 전 Exam days 합집합을 todayKey 부터 거꾸로 세어 종합 연속학습일을 낸다. 일자 키는 dayKey()(UTC)로
// 찍히므로 lib/dates 의 streak(UTC 단일 기준, ADR-0007)을 그대로 쓴다 — Home 의 per-exam streak 과 같은
// 정의. todayKey 를 주입받아 결정적으로 테스트한다.
export function overallStreak(allDays: Record<string, number>[], todayKey: string): number {
  const union: Record<string, number> = {};
  for (const d of allDays) for (const k of Object.keys(d)) if (d[k] > 0) union[k] = 1;
  return streak(union, todayKey);
}

export function buildDashboard(
  rows: { examKey: string; snapshot: Progress }[],
  totalByKey: Record<string, number>,
  todayKey: string,
): DashboardData {
  const exams = rows
    .map((r) => examStat(r.examKey, r.snapshot, totalByKey[r.examKey] ?? 0))
    .filter((e) => e.seen > 0 || e.mine > 0) // 활동(학습 이력 또는 내 문제함=오답·별표·메모) 있는 Exam 만 노출
    .sort((a, b) => (b.lastActiveDay ?? "").localeCompare(a.lastActiveDay ?? ""));
  return {
    exams,
    totalExams: exams.length,
    streak: overallStreak(
      rows.map((r) => r.snapshot.days),
      todayKey,
    ),
    totalSeen: exams.reduce((s, e) => s + e.seen, 0),
    totalWrong: exams.reduce((s, e) => s + e.wrong, 0),
    totalStars: exams.reduce((s, e) => s + e.stars, 0),
    totalMine: exams.reduce((s, e) => s + e.mine, 0),
  };
}
