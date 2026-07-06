// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAnnotationState } from "./annotation-context";
import type { AnnotationStore } from "./annotation-store-remote";
import { inMemoryAnnotationCache } from "./annotation-store-local";
import type { Annotation } from "./annotation";

// useAnnotationState 의 낙관적 CRUD wiring 테스트 (리뷰 C4). 전송을 어댑터로 가른 뒤, 훅은 주입된
// AnnotationStore 위에서 로컬 낙관적 상태 + best-effort 위임만 한다 — 그동안 fetch 가 훅에 용접돼
// 미테스트였던 부분을 spy store 로 고정한다.

const anchor = { quote: "q", prefix: "", suffix: "" };
const annOf = (id: string): Annotation => ({
  id, qn: 1, lang: "ko", field: "q", kind: "highlight", anchor,
});

function spyStore(initial: Annotation[] = []) {
  const load = vi.fn(async () => initial);
  const upsert = vi.fn(async () => {});
  const remove = vi.fn(async () => {});
  const store: AnnotationStore = { load, upsert, remove };
  return { store, load, upsert, remove };
}

describe("useAnnotationState — optimistic CRUD over injected AnnotationStore", () => {
  it("learner 면 마운트 시 store.load 결과로 채운다", async () => {
    const { store } = spyStore([annOf("x")]);
    const { result } = renderHook(() => useAnnotationState("aws/x", "learner-1", store));
    await waitFor(() => expect(result.current.forField(1, "ko", "q")).toHaveLength(1));
    expect(result.current.enabled).toBe(true);
  });

  it("add 는 낙관적으로 로컬에 넣고 store.upsert(exam, ann) 를 호출한다", async () => {
    const { store, upsert, load } = spyStore();
    const { result } = renderHook(() => useAnnotationState("aws/x", "learner-1", store));
    await waitFor(() => expect(load).toHaveBeenCalled());

    let added!: Annotation;
    act(() => {
      added = result.current.add({ qn: 1, lang: "ko", field: "q" }, "highlight", anchor);
    });

    expect(result.current.forField(1, "ko", "q")).toHaveLength(1); // 낙관적 로컬 즉시 반영
    expect(upsert).toHaveBeenCalledWith("aws/x", expect.objectContaining({ id: added.id }));
  });

  it("remove 는 낙관적으로 빼고 store.remove(id) 를 호출한다", async () => {
    const { store, remove } = spyStore([annOf("x")]);
    const { result } = renderHook(() => useAnnotationState("aws/x", "learner-1", store));
    await waitFor(() => expect(result.current.forField(1, "ko", "q")).toHaveLength(1));

    act(() => result.current.remove("x"));

    expect(result.current.forField(1, "ko", "q")).toHaveLength(0);
    expect(remove).toHaveBeenCalledWith("x");
  });

  it("익명(learnerId null)이면 비활성 — store.load 를 부르지 않는다", async () => {
    const { store, load } = spyStore([annOf("x")]);
    const { result } = renderHook(() => useAnnotationState("aws/x", null, store));
    expect(result.current.enabled).toBe(false);
    expect(result.current.forField(1, "ko", "q")).toHaveLength(0);
    expect(load).not.toHaveBeenCalled();
  });
});

describe("useAnnotationState — 로컬 캐시 미러(ADR-0016, 새로고침·오프라인 생존)", () => {
  it("서버 로드 실패(오프라인)여도 캐시에서 복원 — 빈 상태로 두지 않는다", async () => {
    const cache = inMemoryAnnotationCache();
    cache.write("learner-1", "aws/x", [annOf("cached")]);
    const load = vi.fn(async () => {
      throw new Error("offline");
    });
    const store: AnnotationStore = { load, upsert: vi.fn(), remove: vi.fn() };

    const { result } = renderHook(() =>
      useAnnotationState("aws/x", "learner-1", store, cache),
    );

    await waitFor(() => expect(load).toHaveBeenCalled());
    expect(result.current.forField(1, "ko", "q").map((a) => a.id)).toEqual(["cached"]);
  });

  it("캐시 우선 표시 후 서버 성공 시 server-wins 로 덮고 캐시 재정합", async () => {
    const cache = inMemoryAnnotationCache();
    cache.write("learner-1", "aws/x", [annOf("stale")]);
    const { store } = spyStore([annOf("fresh")]); // 서버 권위 데이터

    const { result } = renderHook(() =>
      useAnnotationState("aws/x", "learner-1", store, cache),
    );

    await waitFor(() =>
      expect(result.current.forField(1, "ko", "q").map((a) => a.id)).toEqual(["fresh"]),
    );
    expect(cache.read("learner-1", "aws/x").map((a) => a.id)).toEqual(["fresh"]); // 캐시 재정합
  });

  it("add 는 캐시에 write-through 한다(새로고침 생존)", async () => {
    const cache = inMemoryAnnotationCache();
    const { store, load } = spyStore();
    const { result } = renderHook(() =>
      useAnnotationState("aws/x", "learner-1", store, cache),
    );
    await waitFor(() => expect(load).toHaveBeenCalled());

    let added!: Annotation;
    act(() => {
      added = result.current.add({ qn: 1, lang: "ko", field: "q" }, "highlight", anchor);
    });

    await waitFor(() =>
      expect(cache.read("learner-1", "aws/x").map((a) => a.id)).toEqual([added.id]),
    );
  });

  it("remove 는 캐시에서도 뺀다", async () => {
    const cache = inMemoryAnnotationCache();
    const { store } = spyStore([annOf("x")]);
    const { result } = renderHook(() =>
      useAnnotationState("aws/x", "learner-1", store, cache),
    );
    await waitFor(() => expect(result.current.forField(1, "ko", "q")).toHaveLength(1));

    act(() => result.current.remove("x"));

    await waitFor(() => expect(cache.read("learner-1", "aws/x")).toEqual([]));
  });

  it("다른 Learner 로 로그인해도 자기 캐시만 읽는다(계정 간 격리)", async () => {
    const cache = inMemoryAnnotationCache();
    cache.write("learner-1", "aws/x", [annOf("l1-secret")]);
    const load = vi.fn(async () => {
      throw new Error("offline");
    });
    const store: AnnotationStore = { load, upsert: vi.fn(), remove: vi.fn() };

    const { result } = renderHook(() =>
      useAnnotationState("aws/x", "learner-2", store, cache),
    );

    await waitFor(() => expect(load).toHaveBeenCalled());
    expect(result.current.forField(1, "ko", "q")).toHaveLength(0); // learner-1 캐시 안 보임
  });
});
