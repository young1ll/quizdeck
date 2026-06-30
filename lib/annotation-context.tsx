"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Anchor, Annotation, AnnotationKind } from "./annotation";
import { remoteApiAnnotationStore, type AnnotationStore } from "./annotation-store-remote";

// 주석 상태 (이슈 #29 / ADR-0005 D). store.tsx 와 같은 hook+Provider 형태 — 로그인 Learner 면
// 주입된 AnnotationStore(기본 /api/annotations 어댑터)로 로드 + 낙관적 CRUD(서버 권위, 로컬 미러).
// 익명이면 비활성(연습은 로그인 게이트 뒤라 Quiz 에선 항상 enabled). 한 시험의 **모든 언어** 주석을
// 보유하고, 소비부가 언어로 거른다. 전송은 어댑터가 소유(progress 대칭, 리뷰 C4) — 훅은 낙관적
// 상태 + best-effort swallow 만 한다.

export interface AnnotationTarget {
  qn: number;
  lang: string;
  field: string;
}

export interface AnnotationContextValue {
  enabled: boolean;
  forField: (qn: number, lang: string, field: string) => Annotation[];
  add: (t: AnnotationTarget, kind: AnnotationKind, anchor: Anchor) => Annotation;
  update: (id: string, patch: Partial<Pick<Annotation, "kind" | "memo">>) => void;
  remove: (id: string) => void;
}

export const AnnotationContext = createContext<AnnotationContextValue | null>(null);

export function useAnnotations(): AnnotationContextValue {
  const c = useContext(AnnotationContext);
  if (!c) throw new Error("useAnnotations must be used within AnnotationContext.Provider");
  return c;
}

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `a-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  }
}

export function useAnnotationState(
  examKey: string,
  learnerId: string | null,
  injected?: AnnotationStore,
): AnnotationContextValue {
  const store = useMemo(() => injected ?? remoteApiAnnotationStore(), [injected]);
  const [items, setItems] = useState<Annotation[]>([]);
  const enabled = !!learnerId;

  // PUT 시 전체 주석을 보내야 하므로 현재 상태를 ref 로도 들고 있는다(updater 안 부수효과 회피).
  const ref = useRef(items);
  useEffect(() => {
    ref.current = items;
  }, [items]);

  // 로그인/시험 바뀌면 서버에서 그 Learner 의 주석 전부를 로드. 익명이면 비운다. best-effort —
  // 실패(오프라인 등)는 swallow 하고 빈 상태로 둔다(어댑터가 throw, 훅이 정책 소유).
  useEffect(() => {
    if (!learnerId) {
      setItems([]);
      return;
    }
    let alive = true;
    store
      .load(examKey)
      .then((data) => {
        if (alive) setItems(data);
      })
      .catch(() => {
        /* best-effort: 오프라인이면 빈 상태로 둔다 */
      });
    return () => {
      alive = false;
    };
  }, [examKey, learnerId, store]);

  const put = useCallback(
    (a: Annotation) => {
      store.upsert(examKey, a).catch(() => {});
    },
    [store, examKey],
  );

  const add = useCallback(
    (t: AnnotationTarget, kind: AnnotationKind, anchor: Anchor): Annotation => {
      const a: Annotation = {
        id: newId(),
        qn: t.qn,
        lang: t.lang,
        field: t.field,
        kind,
        memo: null,
        anchor,
      };
      setItems((prev) => [...prev, a]);
      put(a);
      return a;
    },
    [put],
  );

  const update = useCallback(
    (id: string, patch: Partial<Pick<Annotation, "kind" | "memo">>) => {
      const cur = ref.current.find((a) => a.id === id);
      if (!cur) return;
      const merged = { ...cur, ...patch };
      setItems((prev) => prev.map((a) => (a.id === id ? merged : a)));
      put(merged);
    },
    [put],
  );

  const remove = useCallback(
    (id: string) => {
      setItems((prev) => prev.filter((a) => a.id !== id));
      store.remove(id).catch(() => {});
    },
    [store],
  );

  const forField = useCallback(
    (qn: number, lang: string, field: string) =>
      items.filter((a) => a.qn === qn && a.lang === lang && a.field === field),
    [items],
  );

  return useMemo(
    () => ({ enabled, forField, add, update, remove }),
    [enabled, forField, add, update, remove],
  );
}
