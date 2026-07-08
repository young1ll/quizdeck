// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useConceptDraft } from "./use-concept-draft";
import type { LocalizedConcept } from "./content-localize";

// 개념 편집 오케스트레이션 테스트 (아키텍처 리뷰 C2) — use-question-draft 대칭. 프리플라이트→전송→
// 낙관적 병합을 send 주입으로 렌더 없이 단언.

const initial: LocalizedConcept[] = [
  { svc: "s3", content: { ko: { cat: "c", deff: "d", key: "k", when: "w", trap: "t", vs: "v" } } },
];

function mount(send = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))) {
  const view = renderHook(() => useConceptDraft("aws/x", "ko", initial, { send }));
  return { ...view, send };
}

describe("useConceptDraft", () => {
  it("save 성공: 신규 개념 병합 + draft 초기화", async () => {
    const { result, send } = mount();
    act(() => result.current.openNew());
    act(() =>
      result.current.setField({ svc: "ec2", cat: "c", deff: "d", key: "k", when: "w", trap: "t", vs: "v" }),
    );
    await act(async () => {
      await result.current.save();
    });
    expect(send).toHaveBeenCalledTimes(1);
    expect(result.current.draft).toBeNull();
    expect(result.current.items.some((i) => i.svc === "ec2")).toBe(true);
  });

  it("프리플라이트 실패(필수 필드 누락): err 세팅, send 미호출", async () => {
    const { result, send } = mount();
    act(() => result.current.openNew()); // 전부 빈 문자열 → isValidConcept 실패
    await act(async () => {
      await result.current.save();
    });
    expect(send).not.toHaveBeenCalled();
    expect(result.current.err).toBeTruthy();
  });

  it("remove: send 성공 시 제거", async () => {
    const { result, send } = mount();
    await act(async () => {
      await result.current.remove("s3");
    });
    expect(send).toHaveBeenCalledWith({ kind: "delete-concept", examKey: "aws/x", svc: "s3" });
    expect(result.current.items.some((i) => i.svc === "s3")).toBe(false);
  });
});
