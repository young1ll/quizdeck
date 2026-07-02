// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import AnnotatableText from "./AnnotatableText";
import { LangContext } from "@/lib/lang-context";
import { AnnotationContext, type AnnotationContextValue } from "@/lib/annotation-context";
import type { Annotation } from "@/lib/annotation";

// 렌더 불변식 가드 (리뷰 C3). rangeToOffsets(annotation-dom)는 "각 세그먼트 span = data-start +
// 텍스트노드 하나, 📝 마커는 span 밖" 이라는 렌더 계약에 의존한다. 그 브릿지 로직은 annotation-dom.test
// 가 보고, 여기선 컴포넌트 렌더가 그 계약을 실제로 지키는지 본다 — span 에 element 를 중첩하거나
// 마커를 span 안으로 넣으면(미래 변경) 오프셋이 조용히 어긋나므로, 그걸 빌드 타임에 잡는다.

const ann: Annotation = {
  id: "1", qn: 1, lang: "ko", field: "q", kind: "highlight", memo: "메모",
  anchor: { quote: "beta", prefix: "alpha ", suffix: " gamma" },
};

function renderText(text: string, anns: Annotation[]) {
  const annoCtx: AnnotationContextValue = {
    enabled: true,
    forField: () => anns,
    add: () => anns[0]!,
    update: () => {},
    remove: () => {},
  };
  const langCtx = { lang: "ko", setLang: () => {}, available: ["ko"] };
  return render(
    <LangContext.Provider value={langCtx}>
      <AnnotationContext.Provider value={annoCtx}>
        <AnnotatableText qn={1} field="q" text={text} />
      </AnnotationContext.Provider>
    </LangContext.Provider>,
  );
}

describe("AnnotatableText — offset↔DOM 렌더 계약", () => {
  it("각 data-start span 은 자식이 텍스트노드 하나뿐이다(중첩 element 없음)", () => {
    const { container } = renderText("alpha beta gamma", [ann]);
    const spans = container.querySelectorAll<HTMLElement>("[data-start]");
    expect(spans.length).toBeGreaterThan(0);
    for (const span of spans) {
      expect(span.childNodes.length).toBe(1);
      expect(span.firstChild?.nodeType).toBe(Node.TEXT_NODE);
    }
  });

  it("메모 마커는 어떤 data-start span 안에도 없다", () => {
    const { container } = renderText("alpha beta gamma", [ann]);
    // 메모 마커 = 메모 아이콘(aria-label="메모")을 담은 <sup>. ADR-0014 이모지→Lucide 통일 후에도
    // 마커가 세그먼트 span 밖(user-select:none)에 있어야 선택 오프셋 계약이 유지된다.
    const markers = [...container.querySelectorAll("sup")].filter((s) =>
      s.querySelector('[aria-label="메모"]'),
    );
    expect(markers.length).toBeGreaterThan(0); // 메모 주석 → 마커 렌더됨
    for (const m of markers) {
      expect(m.closest("[data-start]")).toBeNull(); // span 밖
    }
  });

  it("data-start 시작값이 평문 오프셋과 일치한다(첫 세그먼트=0)", () => {
    const { container } = renderText("alpha beta gamma", [ann]);
    const first = container.querySelector<HTMLElement>("[data-start]");
    expect(first?.dataset.start).toBe("0");
  });
});
