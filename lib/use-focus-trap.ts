"use client";

import { useEffect, useRef } from "react";

// 모달 포커스 트랩 (ADR-0008 결정 5c · 이슈 #49).
// active 동안: 컨테이너로 포커스 진입 → Tab/Shift+Tab 을 컨테이너 안에서 순환 → 비활성/언마운트
// 시 직전 포커스(여는 트리거)로 복귀. aria-modal 모달 전용 — 비차단 팝오버엔 적용하지 않는다
// (팝오버는 Tab 으로 빠져나갈 수 있어야 한다).
//
// 반환한 ref 는 트랩 경계가 되는 요소에 단다. 키보드만으로 진입할 수 있도록 그 요소엔 tabIndex={-1}
// 을 함께 주는 게 좋다(포커서블이 없을 때 컨테이너 자신이 포커스를 받는다).

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function useFocusTrap<T extends HTMLElement>(active = true) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!active) return;
    const container = ref.current;
    if (!container) return;

    // 보이는 포커서블만 (display:none·detached 제외).
    const focusables = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.getClientRects().length > 0,
      );

    const previouslyFocused = document.activeElement as HTMLElement | null;
    // 열릴 때 컨테이너로 진입(스크린리더가 dialog 컨텍스트를 읽고, 키보드는 여기서 Tab 으로 들어간다).
    container.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault(); // 가둘 곳이 없으면 밖으로 새지 않게 막기만 한다.
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const here = document.activeElement;
      if (e.shiftKey) {
        // 첫 요소(또는 컨테이너 자신)에서 뒤로 → 마지막으로 순환.
        if (here === first || here === container) {
          e.preventDefault();
          last.focus();
        }
      } else if (here === last) {
        // 마지막에서 앞으로 → 첫 요소로 순환.
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      previouslyFocused?.focus?.(); // 트리거로 복귀.
    };
  }, [active]);

  return ref;
}
