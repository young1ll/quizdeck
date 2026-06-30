// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { rangeToOffsets } from "./annotation-dom";
import { segmentText, type Annotation } from "./annotation";

// offset↔DOM round-trip 테스트 (리뷰 C3). 그동안 컴포넌트에 묻혀 미테스트였던 취약한 절반.
// segmentText 출력을 AnnotatableText 와 **같은 규칙**으로 DOM 에 렌더(각 세그먼트 = data-start span
// (텍스트노드 1개), 메모 세그먼트엔 📝 마커를 span 밖) → 알려진 평문 구간의 Range 를 만들어
// rangeToOffsets 가 그 [s,e] 를 정확히 되돌리는지 본다. jsdom 의 getSelection 은 불완전하나
// createRange + setStart/End 는 동작하므로 Range 를 직접 구성한다.

function renderSegments(plain: string, anns: Annotation[]): HTMLElement {
  const { segments } = segmentText(plain, anns);
  const container = document.createElement("span");
  for (const seg of segments) {
    const span = document.createElement("span");
    span.dataset.start = String(seg.start);
    span.textContent = seg.text; // 단일 텍스트노드 — 불변식
    if (seg.annotations.length === 0) {
      container.appendChild(span);
    } else {
      const wrap = document.createElement("span");
      wrap.appendChild(span);
      if (seg.annotations.some((a) => a.memo)) {
        const sup = document.createElement("sup"); // 📝 마커는 data-start span **밖**
        sup.textContent = "📝";
        wrap.appendChild(sup);
      }
      container.appendChild(wrap);
    }
  }
  document.body.appendChild(container);
  return container;
}

// 평문 오프셋 → 그 위치를 담은 data-start span 의 (텍스트노드, 노드내 offset).
function pointAt(container: HTMLElement, plainOffset: number): { node: Node; offset: number } {
  for (const span of container.querySelectorAll<HTMLElement>("[data-start]")) {
    const start = Number(span.dataset.start);
    const text = span.firstChild!;
    const len = text.textContent!.length;
    if (plainOffset >= start && plainOffset <= start + len) {
      return { node: text, offset: plainOffset - start };
    }
  }
  throw new Error(`offset ${plainOffset} not in any segment`);
}

function rangeOf(container: HTMLElement, s: number, e: number): Range {
  const a = pointAt(container, s);
  const b = pointAt(container, e);
  const range = document.createRange();
  range.setStart(a.node, a.offset);
  range.setEnd(b.node, b.offset);
  return range;
}

const memoAnn = (quote: string, prefix: string, suffix: string): Annotation => ({
  id: "1", qn: 1, lang: "ko", field: "q", kind: "highlight", memo: "note",
  anchor: { quote, prefix, suffix },
});

describe("rangeToOffsets — offset↔DOM round-trip", () => {
  it("주석 없는 평문에서 선택 구간을 평문 오프셋으로 되돌린다", () => {
    const c = renderSegments("hello world foo", []);
    expect(rangeToOffsets(c, rangeOf(c, 6, 11))).toEqual({ start: 6, end: 11 }); // "world"
  });

  it("여러 세그먼트(주석 경계)를 가로지르는 선택도 정확하다", () => {
    const c = renderSegments("the quick brown fox", [memoAnn("quick", "the ", " brown")]);
    // 세그먼트 "the "|"quick"|" brown fox" 를 가로질러 [4,15)="quick brown"
    expect(rangeToOffsets(c, rangeOf(c, 4, 15))).toEqual({ start: 4, end: 15 });
  });

  it("📝 마커(span 밖)는 뒤따르는 세그먼트의 오프셋을 어긋내지 않는다", () => {
    const c = renderSegments("alpha beta gamma", [memoAnn("beta", "alpha ", " gamma")]);
    // "beta" 세그먼트 뒤에 마커가 있어도 다음 세그먼트 "gamma" 선택이 평문 [11,16) 으로 정확
    expect(rangeToOffsets(c, rangeOf(c, 11, 16))).toEqual({ start: 11, end: 16 });
  });

  it("끝점이 어떤 data-start span 에도 안 속하면 null", () => {
    const c = renderSegments("hello", []);
    const outside = document.createElement("div");
    outside.textContent = "x";
    document.body.appendChild(outside);
    const range = document.createRange();
    range.setStart(outside.firstChild!, 0);
    range.setEnd(outside.firstChild!, 1);
    expect(rangeToOffsets(c, range)).toBeNull();
  });

  it("빈/collapsed 선택은 null", () => {
    const c = renderSegments("hello world", []);
    expect(rangeToOffsets(c, rangeOf(c, 3, 3))).toBeNull();
  });
});
