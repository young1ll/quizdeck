import { mastery, accuracy, myProblems, type Progress } from "./progress";
import { streak } from "./dates";
import { topicStat } from "./session";
import type { Question } from "./types";

// per-exam 뷰모델 (아키텍처 리뷰 examView). /me(dashboard.ts)가 전-Exam 롤업을 순수·테스트로 내듯,
// 이 모듈은 **한 Exam** 의 Progress 로 per-exam 화면(허브·/stats·setup)이 쓰는 글랜스/심화 지표를 낸다.
// 뷰가 JSX 안에서 재파생하던 mastery·정답률·카운트·연속일·약한 주제를 한 곳으로 모아 결정적으로 테스트한다.
// mastery·accuracy·myProblems(progress) · streak(dates) · topicStat(session) 재사용 — 정의가 흩어지지 않는다.
// todayKey 주입으로 순수(streak·오늘 카운트가 결정적).

type Topics = ReturnType<typeof topicStat>;

export interface ExamView {
  total: number; // 문항 수
  seen: number; // 학습한(이력 있는) 문항 수
  mastery: number; // % — 마지막 정답 비율(mastered/total)
  accuracy: number; // % — 시도 정답률(correct/attempts), Mastery 와 다른 지표
  wrong: number; // 오답노트 크기
  stars: number; // 즐겨찾기 수
  mine: number; // 내 문제함 크기(오답∪별표∪메모)
  memos: number; // 메모 달린 문항 수
  streak: number; // 연속 학습일
  todayCount: number; // 오늘 학습 횟수
  goal: number; // 일일 목표
  weakTopics: string[]; // 약한 주제 상위 3(seen≥3 · 정답률<70%, 오름차순), 접두 이모지 제거
  topics: Topics; // 주제별 {n, seen, ok}
}

export function examView(
  p: Progress,
  questions: Question[],
  total: number,
  todayKey: string,
): ExamView {
  const topics = topicStat(questions, p.hist);
  const rate = (m: { ok: number; seen: number }) => (m.seen ? m.ok / m.seen : 2);
  const weakTopics = Object.entries(topics)
    .filter(([, m]) => m.seen >= 3 && m.ok / m.seen < 0.7)
    .sort((a, b) => rate(a[1]) - rate(b[1]))
    .map(([t]) => t.replace(/^\S+\s/, ""))
    .slice(0, 3);
  return {
    total,
    seen: Object.keys(p.hist).length,
    mastery: mastery(p, total),
    accuracy: accuracy(p),
    wrong: p.wrong.length,
    stars: p.stars.length,
    mine: myProblems(p).length,
    memos: Object.keys(p.memos).length,
    streak: streak(p.days, todayKey),
    todayCount: p.days[todayKey] ?? 0,
    goal: p.prefs.goal,
    weakTopics,
    topics,
  };
}
