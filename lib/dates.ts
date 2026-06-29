// lib/dates.ts — 날짜·일자 키·연속학습일 (전부 UTC, ADR-0007 결정 3).
//
// 활동 키는 dayKey() 가 UTC(toISOString)로 발급한다 — today/streak 도 같은 UTC 기준으로 도출해
// store(클라)·dashboard(RSC)·progress 가 한 정의를 공유한다. (이전엔 store.streak 이 키는 UTC,
// 스텝은 로컬(setDate)이라 혼합 TZ → DST 지역에서 연속일을 오산했다.) DOM 무접촉 순수 함수라
// 클라·서버 양쪽에서 import 한다.

/** ms 타임스탬프 → "YYYY-MM-DD" UTC 일자 키. */
export function dayKey(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

/** 오늘의 UTC 일자 키. now 미지정 시 현재 시각. */
export function today(now: number = Date.now()): string {
  return dayKey(now);
}

/** UTC 일자 키를 delta 일만큼 옮긴 새 키. */
export function addDays(key: string, delta: number): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** todayKey 부터 거꾸로, 활동(값 > 0)이 끊김 없이 이어진 일수. */
export function streak(days: Record<string, number>, todayKey: string = today()): number {
  let s = 0;
  let k = todayKey;
  while (days[k]) {
    s++;
    k = addDays(k, -1);
  }
  return s;
}
