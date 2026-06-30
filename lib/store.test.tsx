// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useStoreState } from "./store";
import type { ProgressStore, StoredProgress } from "./progress-store";

// useStoreState 의 LWW save wiring 테스트 (리뷰 C2). 순수 reducer(progress.test)·composite
// (composite.test)는 철저히 테스트됐으나, hook 이 save 를 어떻게 트리거하는지 — LWW stamp 를 어디서
// 민팅하고 save 를 몇 번 호출하는지 — 는 그동안 미테스트였다. 그 wiring 이 실제 ships 되는 경로다.
//
// 검증: (1) stamp 가 주입 시계로 결정적이고 mutation 당 save 가 정확히 1회, (2) 연속 mutation 이
// ref 로 합성된다(둘째가 첫째 결과 위에 적용 — setState updater 의 prev 누적과 동치).

function spyStore(): { store: ProgressStore; saved: StoredProgress[] } {
  const saved: StoredProgress[] = [];
  return {
    saved,
    store: {
      async load() {
        return null; // 비어 있음 — 마운트 load 는 save 를 트리거하지 않는다
      },
      async save(_key, snapshot, updatedAt) {
        saved.push({ snapshot, updatedAt });
      },
    },
  };
}

describe("useStoreState — LWW save wiring", () => {
  it("mutation 은 주입 시계의 stamp 로 save 를 정확히 1회 호출한다", async () => {
    const { store, saved } = spyStore();
    const { result } = renderHook(() => useStoreState("aws/x", store, () => 5000));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    act(() => result.current.toggleStar(1));

    expect(saved).toHaveLength(1); // setState updater 밖 → mutation 당 1회(이중 save 없음)
    expect(saved[0].updatedAt).toBe(5000); // 주입 시계 — Date.now 아님
    expect(saved[0].snapshot.stars).toEqual([1]);
  });

  it("연속 mutation 은 ref 로 합성된다 — 둘째가 첫째 위에 쌓인다", async () => {
    const { store, saved } = spyStore();
    const { result } = renderHook(() => useStoreState("aws/x", store, () => 5000));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    act(() => result.current.toggleStar(1));
    act(() => result.current.toggleStar(2));

    expect(saved).toHaveLength(2);
    expect(saved[1].snapshot.stars).toEqual([1, 2]); // 둘째가 빈 상태가 아니라 [1] 위에 적용됨
  });

  it("같은 qn 토글 2회는 합성되어 별이 사라진다(둘째가 stale prev 를 보지 않는다)", async () => {
    const { store, saved } = spyStore();
    const { result } = renderHook(() => useStoreState("aws/x", store, () => 5000));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    act(() => result.current.toggleStar(1));
    act(() => result.current.toggleStar(1));

    expect(saved[1].snapshot.stars).toEqual([]); // 합성 깨졌으면 둘째가 빈 prev → [1] 이 됨
  });
});
