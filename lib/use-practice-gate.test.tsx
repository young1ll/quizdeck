// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePracticeGate } from "./use-practice-gate";

// 연습 게이트 오케스트레이션 테스트 (아키텍처 리뷰 — ExamProviders God-wiring 분해). 게이트는 무테스트로
// JSX 에 용접돼 있었다 — pending·resume-after-login·신규가입 보류가 미묘한데 회귀 방어가 없었다. 심으로
// 빼서 session 을 인자로 주입해(useSession mock 불필요) 전이를 직접 단언한다. isLearner=emailVerified===true.
type Sess = Parameters<typeof usePracticeGate>[0];
const verified: Sess = { user: { id: "u1", emailVerified: true } };
const anon: Sess = null;
const unverified: Sess = { user: { id: "u2", emailVerified: false } }; // 가입했으나 미인증

// Props 를 명시 타입해 rerender 가 세션을 바꿀 수 있게 한다(익명→로그인 전이 재현).
function mount(session: Sess) {
  return renderHook((props: { session: Sess }) => usePracticeGate(props.session), {
    initialProps: { session },
  });
}

describe("usePracticeGate — 연습 게이트", () => {
  it("verified Learner: 즉시 실행, 모달 안 뜸", () => {
    const { result } = mount(verified);
    const action = vi.fn();
    act(() => result.current.requireLearner(action));
    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.gateOpen).toBe(false);
  });

  it("익명: 액션 보류 + 모달 오픈, 아직 실행 안 함", () => {
    const { result } = mount(anon);
    const action = vi.fn();
    act(() => result.current.requireLearner(action));
    expect(action).not.toHaveBeenCalled();
    expect(result.current.gateOpen).toBe(true);
  });

  it("로그인 성공(익명→verified): 보류 액션 발화 + 모달 닫힘", () => {
    const { result, rerender } = mount(anon);
    const action = vi.fn();
    act(() => result.current.requireLearner(action));
    expect(result.current.gateOpen).toBe(true);
    act(() => rerender({ session: verified })); // 로그인 성공 → 세션이 Learner 로
    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.gateOpen).toBe(false);
  });

  it("신규 가입(익명→미인증): 보류 유지, 실행 안 함('메일 확인' 상태)", () => {
    const { result, rerender } = mount(anon);
    const action = vi.fn();
    act(() => result.current.requireLearner(action));
    act(() => rerender({ session: unverified }));
    expect(action).not.toHaveBeenCalled();
    expect(result.current.gateOpen).toBe(true);
  });

  it("closeGate: 보류 액션 버림 — 이후 로그인해도 발화 안 함", () => {
    const { result, rerender } = mount(anon);
    const action = vi.fn();
    act(() => result.current.requireLearner(action));
    act(() => result.current.closeGate());
    expect(result.current.gateOpen).toBe(false);
    act(() => rerender({ session: verified }));
    expect(action).not.toHaveBeenCalled();
  });
});
