// lib/format.ts — 문자열 정규화 유틸 (순수, ADR-0007 결정 2).

/**
 * 이메일 정규화 — 앞뒤 공백 제거 + 소문자화. 모바일 자동완성이 붙이는 공백/대문자가
 * better-auth lookup 에서 "User not found" 를 유발하므로 제출 전 통일한다.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
