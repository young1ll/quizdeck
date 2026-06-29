// 인라인 주석 — plain-text 앵커 로직 (이슈 #29 / ADR-0005 D). client-safe(순수, no pg) — 클라이언트
// (AnnotatableText)와 서버 검증이 공유한다. 콘텐츠는 미니 마크다운이라 **렌더된 평문**(굵게/코드 마커
// 제거, 줄바꿈 유지)에 앵커한다 — 사용자가 선택하는 텍스트가 곧 평문이므로. 평문 오프셋 기준 quote +
// 앞/뒤 문맥(W3C TextQuoteSelector 류)으로 위치를 복원한다. 본문이 바뀌어 quote 를 못 찾으면
// null(=orphan) — 메모는 보존하되 위치만 뗀다(AC: graceful orphan).

export type AnnotationKind = "underline" | "highlight";

export interface Anchor {
  quote: string; // 선택된 평문 구간
  prefix: string; // 바로 앞 문맥(최대 CTX 자)
  suffix: string; // 바로 뒤 문맥(최대 CTX 자)
}

export interface Annotation {
  id: string;
  qn: number;
  lang: string;
  field: string; // 'q' | 'explanation' | 'tip' | 'opt:A' …
  kind: AnnotationKind;
  memo?: string | null;
  anchor: Anchor;
  updatedAt?: number;
}

const CTX = 24; // 문맥 길이 — disambiguation 충분 + 본문 소량 변경에 견고

// 미니 마크다운 마커(**굵게**, `코드`) 제거 → 사용자가 화면에서 보고/선택하는 평문. 줄바꿈은
// 유지한다(렌더는 white-space:pre-wrap → 평문 오프셋이 선택 오프셋과 1:1).
export function toPlainText(src: string | undefined): string {
  if (!src) return "";
  return src.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/`([^`]+)`/g, "$1");
}

// 평문 [start,end) 에서 앵커(quote + 앞/뒤 문맥) 생성.
export function makeAnchor(plain: string, start: number, end: number): Anchor {
  return {
    quote: plain.slice(start, end),
    prefix: plain.slice(Math.max(0, start - CTX), start),
    suffix: plain.slice(end, end + CTX),
  };
}

// 앵커를 평문에서 재배치 → {start,end} 또는 null(quote 부재 = orphan).
// quote 가 여러 번 나오면 prefix/suffix 정렬 일치가 가장 큰 위치를 고른다.
export function locateAnchor(
  plain: string,
  anchor: Anchor,
): { start: number; end: number } | null {
  const { quote, prefix, suffix } = anchor;
  if (!quote) return null;
  let best: { start: number; score: number } | null = null;
  let from = 0;
  for (;;) {
    const idx = plain.indexOf(quote, from);
    if (idx < 0) break;
    const before = plain.slice(Math.max(0, idx - prefix.length), idx);
    const after = plain.slice(idx + quote.length, idx + quote.length + suffix.length);
    const score = suffixMatch(before, prefix) + prefixMatch(after, suffix);
    if (!best || score > best.score) best = { start: idx, score };
    from = idx + 1;
  }
  if (!best) return null;
  return { start: best.start, end: best.start + quote.length };
}

// expected 의 끝과 actual 의 끝이 몇 글자나 연속 일치하는가(앞 문맥용).
function suffixMatch(actual: string, expected: string): number {
  let n = 0;
  const max = Math.min(actual.length, expected.length);
  for (let i = 1; i <= max; i++) {
    if (actual[actual.length - i] === expected[expected.length - i]) n++;
    else break;
  }
  return n;
}

// expected 의 앞과 actual 의 앞이 몇 글자나 연속 일치하는가(뒤 문맥용).
function prefixMatch(actual: string, expected: string): number {
  let n = 0;
  const max = Math.min(actual.length, expected.length);
  for (let i = 0; i < max; i++) {
    if (actual[i] === expected[i]) n++;
    else break;
  }
  return n;
}

export interface Segment {
  start: number;
  end: number;
  text: string;
  annotations: Annotation[]; // 이 구간을 덮는 주석들(겹침 시 다수, 빈 배열 = 평문)
}

export interface SegmentResult {
  segments: Segment[]; // 평문 전체를 빈틈없이 덮는 정렬된 구간들
  orphans: Annotation[]; // 본문에서 quote 를 못 찾은 주석(메모 보존·위치 상실)
}

// 평문을 주석 경계로 쪼개 각 구간을 덮는 주석 목록과 함께 돌려준다. 위치를 못 찾은 주석은 orphans.
export function segmentText(plain: string, annotations: Annotation[]): SegmentResult {
  const located: { a: Annotation; start: number; end: number }[] = [];
  const orphans: Annotation[] = [];
  for (const a of annotations) {
    const loc = locateAnchor(plain, a.anchor);
    if (loc && loc.end > loc.start) located.push({ a, start: loc.start, end: loc.end });
    else orphans.push(a);
  }

  const bounds = new Set<number>([0, plain.length]);
  for (const l of located) {
    bounds.add(l.start);
    bounds.add(l.end);
  }
  const points = [...bounds]
    .filter((p) => p >= 0 && p <= plain.length)
    .sort((x, y) => x - y);

  const segments: Segment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    if (end <= start) continue;
    const covering = located
      .filter((l) => l.start <= start && l.end >= end)
      .map((l) => l.a);
    segments.push({ start, end, text: plain.slice(start, end), annotations: covering });
  }
  return { segments, orphans };
}
