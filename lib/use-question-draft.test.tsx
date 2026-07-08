// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useQuestionDraft } from "./use-question-draft";
import type { LocalizedQuestion } from "./content-localize";

// 문항 편집 오케스트레이션 테스트 (아키텍처 리뷰 C2). 그동안 ContentEditor useState 클로저에 갇혀
// 미검증이던 프리플라이트→전송→낙관적 병합 전이를 send 주입(fake)으로 렌더 없이 단언한다.

const initial: LocalizedQuestion[] = [
  { qn: 1, answer: ["A"], content: { ko: { topic: "t", q: "Q1", options: { A: "a", B: "b" } } } },
];

function mount(send = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))) {
  const view = renderHook(() => useQuestionDraft("aws/x", "ko", initial, { send }));
  return { ...view, send };
}

describe("useQuestionDraft", () => {
  it("openNew: nextQn 로 draft 채우고 isNew=true", () => {
    const { result } = mount();
    act(() => result.current.openNew());
    expect(result.current.draft?.qn).toBe(2);
    expect(result.current.isNew).toBe(true);
  });

  it("save 성공: items 병합 + draft 초기화 + send 1회", async () => {
    const { result, send } = mount();
    act(() => result.current.openNew());
    act(() => result.current.setField({ topic: "t", q: "새문항", options: { A: "a" }, answer: ["A"] }));
    await act(async () => {
      await result.current.save();
    });
    expect(send).toHaveBeenCalledTimes(1);
    expect(result.current.draft).toBeNull();
    expect(result.current.items.some((i) => i.qn === 2)).toBe(true);
  });

  it("프리플라이트 실패(정답 ⊄ options): err 세팅, send 미호출", async () => {
    const { result, send } = mount();
    act(() => result.current.openNew());
    act(() => result.current.setField({ topic: "t", q: "q", options: { A: "a" }, answer: [] }));
    act(() => result.current.toggleAns("Z")); // Z ∉ options
    await act(async () => {
      await result.current.save();
    });
    expect(send).not.toHaveBeenCalled();
    expect(result.current.err).toBeTruthy();
  });

  it("서버 에러: err 에 status 포함, items 불변", async () => {
    const send = vi.fn().mockResolvedValue(new Response("boom", { status: 400 }));
    const { result } = mount(send);
    act(() => result.current.openNew());
    act(() => result.current.setField({ topic: "t", q: "새문항", options: { A: "a" }, answer: ["A"] }));
    await act(async () => {
      await result.current.save();
    });
    expect(result.current.err).toContain("400");
    expect(result.current.items.some((i) => i.qn === 2)).toBe(false);
  });

  it("remove: send 성공 시 items 에서 제거", async () => {
    const { result, send } = mount();
    await act(async () => {
      await result.current.remove(1);
    });
    expect(send).toHaveBeenCalledWith({ kind: "delete-question", examKey: "aws/x", qn: 1 });
    expect(result.current.items.some((i) => i.qn === 1)).toBe(false);
  });

  it("옵션 편집: addOpt·toggleAns·removeOpt(정답 prune)", () => {
    const { result } = mount();
    act(() => result.current.openNew()); // options {A:""}
    act(() => result.current.addOpt()); // +B
    expect(Object.keys(result.current.draft!.options)).toEqual(["A", "B"]);
    act(() => result.current.toggleAns("B"));
    expect(result.current.draft!.answer).toEqual(["B"]);
    act(() => result.current.removeOpt("B")); // 정답에서도 prune
    expect(result.current.draft!.answer).toEqual([]);
    expect(Object.keys(result.current.draft!.options)).toEqual(["A"]);
  });
});
