// 컬렉션 도메인 (ADR-0022). Learner 가 문항을 직접 담고 빼는 큐레이션 세트 — 파생인 내 문제함
// (ADR-0011)과 별개 개념이며, items 가 (examKey, qn) 참조라 Exam 경계를 넘는다. client-safe 순수
// (no pg) — 경계 검증(parseCollection)과 아이템 결정(add/remove/group)을 API·UI 양쪽이 공유한다
// (annotation 의 parseAnnotation, content 의 parseContentCommand 와 같은 결).

export interface CollectionItem {
  examKey: string; // "provider/slug" — Progress·question 과 같은 키
  qn: number;
}

export interface Collection {
  id: string; // client 생성 uuid — 기기 간 같은 컬렉션을 식별(annotation 선례)
  name: string;
  items: CollectionItem[]; // 담은 순서 보존, (examKey, qn) 중복 없음
  updatedAt: number; // ms epoch
}

export const COLLECTION_NAME_MAX = 60;
export const COLLECTION_ITEMS_MAX = 500;

const itemKey = (i: CollectionItem) => `${i.examKey}#${i.qn}`;

function isItem(v: unknown): v is CollectionItem {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.examKey === "string" &&
    o.examKey.length > 0 &&
    typeof o.qn === "number" &&
    Number.isInteger(o.qn) &&
    o.qn > 0
  );
}

/** 경계 검증 — API 가 client body 를 신뢰하지 않고 이걸로만 받는다. 실패 시 null. */
export function parseCollection(raw: unknown): Collection | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || !o.id) return null;
  const name = typeof o.name === "string" ? o.name.trim() : "";
  if (!name || name.length > COLLECTION_NAME_MAX) return null;
  if (!Array.isArray(o.items) || o.items.length > COLLECTION_ITEMS_MAX) return null;
  if (!o.items.every(isItem)) return null;
  // (examKey, qn) 중복은 거부하지 않고 정규화(첫 등장 순서 보존) — 클라 버그가 서버 상태를 더럽히지 않게.
  const seen = new Set<string>();
  const items: CollectionItem[] = [];
  for (const it of o.items as CollectionItem[]) {
    const k = itemKey(it);
    if (seen.has(k)) continue;
    seen.add(k);
    items.push({ examKey: it.examKey, qn: it.qn });
  }
  const updatedAt = typeof o.updatedAt === "number" ? o.updatedAt : Date.now();
  return { id: o.id, name, items, updatedAt };
}

/** 담기 — 이미 있으면 그대로(중복 없음 불변식), 새 항목은 끝에(담은 순서 보존). */
export function addItem(items: CollectionItem[], item: CollectionItem): CollectionItem[] {
  return hasItem(items, item) ? items : [...items, item];
}

/** 빼기 — 없으면 그대로. */
export function removeItem(items: CollectionItem[], item: CollectionItem): CollectionItem[] {
  return items.filter((i) => itemKey(i) !== itemKey(item));
}

export function hasItem(items: CollectionItem[], item: CollectionItem): boolean {
  const k = itemKey(item);
  return items.some((i) => itemKey(i) === k);
}

/** 시험별 그룹(첫 등장 순) — 상세 화면 표시·시험별 풀기 진입(S1)·혼합 큐 조립(S2)이 공유. */
export function groupItemsByExam(items: CollectionItem[]): { examKey: string; qns: number[] }[] {
  const byExam = new Map<string, number[]>();
  for (const i of items) {
    const arr = byExam.get(i.examKey) ?? [];
    arr.push(i.qn);
    byExam.set(i.examKey, arr);
  }
  return [...byExam.entries()].map(([examKey, qns]) => ({ examKey, qns }));
}
