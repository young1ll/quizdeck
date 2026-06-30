// offset↔DOM 브릿지 (이슈 #29 / ADR-0005 D · 아키텍처 리뷰 C3). 선택 Range 를 평문 전역 오프셋으로
// 되돌린다. annotation.ts(순수 문자열 앵커 모델)와 갈라 DOM 관심을 분리한다 — AnnotatableText 가
// 쓰는 클라이언트 브릿지다. 그동안 컴포넌트 안에 묻혀 미테스트였던 취약한 절반(리뷰 C3).
//
// 불변식: 각 세그먼트 span 은 data-start 를 갖고 **텍스트노드 하나만** 담는다(📝 마커는 span 밖,
// user-select:none). 그러면 선택 끝점의 노드내 offset 을 그 span 의 data-start 에 그대로 더해 평문
// 오프셋이 된다 — segmentText 의 data-start 렌더(AnnotatableText)와 정확히 역(round-trip). 세그먼트
// span 에 자식 element 를 중첩하거나 마커를 span 안에 넣으면 이 불변식이 깨져 오프셋이 어긋난다.

// 선택 끝점(텍스트노드, 노드내 offset) → 평문 전역 오프셋. 조상 중 data-start 세그먼트 span 을 찾아
// 그 시작 + offset. 끝점이 어떤 세그먼트 span 에도 안 속하면(컨테이너 밖 등) null.
export function offsetOf(node: Node, offset: number, container: HTMLElement): number | null {
  let el: Node | null = node.nodeType === Node.TEXT_NODE ? node.parentNode : node;
  while (el && el !== container) {
    if (el instanceof HTMLElement && el.dataset.start != null) {
      return Number(el.dataset.start) + offset;
    }
    el = el.parentNode;
  }
  return null;
}

// 선택 Range → 평문 [start,end). 양 끝점을 offsetOf 로 풀어 정렬한다. 끝점이 세그먼트 밖이거나
// 빈/역전 선택이면 null. onMouseUp 의 '선택 → 오프셋' 전체를 소유 — 컴포넌트는 한 줄로 위임한다.
export function rangeToOffsets(
  container: HTMLElement,
  range: Range,
): { start: number; end: number } | null {
  const a = offsetOf(range.startContainer, range.startOffset, container);
  const b = offsetOf(range.endContainer, range.endOffset, container);
  if (a == null || b == null) return null;
  const start = Math.min(a, b);
  const end = Math.max(a, b);
  if (end <= start) return null;
  return { start, end };
}
