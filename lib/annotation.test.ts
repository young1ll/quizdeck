import { describe, expect, it } from "vitest";
import {
  findAnnotationAt,
  makeAnchor,
  locateAnchor,
  segmentText,
  toPlainText,
  type Annotation,
} from "./annotation";

describe("findAnnotationAt", () => {
  const ann = (id: string, quote: string, prefix: string, suffix: string): Annotation => ({
    id, qn: 1, lang: "ko", field: "q", kind: "highlight", anchor: { quote, prefix, suffix },
  });
  const plain = "the quick brown fox";

  it("앵커 재배치 후 [start,end) 가 정확히 일치하는 주석을 찾는다", () => {
    const anns = [ann("a", "quick", "the ", " brown"), ann("b", "brown", "quick ", " fox")];
    expect(findAnnotationAt(plain, anns, 4, 9)?.id).toBe("a"); // "quick"
    expect(findAnnotationAt(plain, anns, 10, 15)?.id).toBe("b"); // "brown"
  });

  it("그 구간에 정확히 걸린 주석이 없으면 undefined", () => {
    const anns = [ann("a", "quick", "the ", " brown")];
    expect(findAnnotationAt(plain, anns, 0, 3)).toBeUndefined(); // "the"
    expect(findAnnotationAt(plain, anns, 4, 8)).toBeUndefined(); // 부분 겹침
  });
});

const ann = (over: Partial<Annotation> & { anchor: Annotation["anchor"] }): Annotation => ({
  id: "a1",
  qn: 1,
  lang: "ko",
  field: "q",
  kind: "highlight",
  ...over,
});

describe("toPlainText", () => {
  it("미니 마크다운 마커를 제거하되 줄바꿈은 보존한다", () => {
    expect(toPlainText("**굵게** 와 `코드`")).toBe("굵게 와 코드");
    expect(toPlainText("첫 줄\n둘째 줄")).toBe("첫 줄\n둘째 줄");
    expect(toPlainText(undefined)).toBe("");
  });
});

describe("makeAnchor / locateAnchor", () => {
  const plain = "Amazon S3 는 객체 스토리지이고 EBS 는 블록 스토리지이다";

  it("선택 구간을 quote + 앞/뒤 문맥으로 잡고 그대로 재배치한다", () => {
    const start = plain.indexOf("객체 스토리지");
    const anchor = makeAnchor(plain, start, start + "객체 스토리지".length);
    expect(anchor.quote).toBe("객체 스토리지");
    expect(locateAnchor(plain, anchor)).toEqual({
      start,
      end: start + "객체 스토리지".length,
    });
  });

  it("quote 가 여러 번 나오면 앞/뒤 문맥으로 올바른 위치를 고른다", () => {
    // "스토리지" 가 두 번 — 두 번째(블록 스토리지)를 prefix 로 가려낸다.
    const second = plain.indexOf("스토리지", plain.indexOf("스토리지") + 1);
    const anchor = makeAnchor(plain, second, second + "스토리지".length);
    expect(locateAnchor(plain, anchor)).toEqual({ start: second, end: second + 4 });
  });

  it("본문에서 quote 가 사라지면 null(=orphan)", () => {
    const anchor = makeAnchor(plain, 0, 9); // "Amazon S3"
    expect(locateAnchor("완전히 다른 본문", anchor)).toBeNull();
  });

  it("빈 quote 는 null", () => {
    expect(locateAnchor(plain, { quote: "", prefix: "", suffix: "" })).toBeNull();
  });
});

describe("segmentText", () => {
  const plain = "Amazon S3 는 객체 스토리지이다";

  it("주석 하나 → 앞/구간/뒤 3분할, 가운데만 그 주석을 덮는다", () => {
    const start = plain.indexOf("객체 스토리지");
    const a = ann({ anchor: makeAnchor(plain, start, start + 7) });
    const { segments, orphans } = segmentText(plain, [a]);
    expect(orphans).toHaveLength(0);
    expect(segments.map((s) => s.text).join("")).toBe(plain); // 빈틈없이 덮음
    const covered = segments.filter((s) => s.annotations.length > 0);
    expect(covered).toHaveLength(1);
    expect(covered[0].text).toBe("객체 스토리지");
  });

  it("겹치는 두 주석 → 겹친 구간이 둘 다를 덮는다", () => {
    const a = ann({ id: "a", anchor: makeAnchor(plain, 0, 12) }); // "Amazon S3 는 "
    const b = ann({ id: "b", anchor: makeAnchor(plain, 7, plain.length) }); // "S3 는 객체…"
    const { segments } = segmentText(plain, [a, b]);
    const both = segments.find((s) => s.annotations.length === 2);
    expect(both).toBeTruthy();
    expect(both!.annotations.map((x) => x.id).sort()).toEqual(["a", "b"]);
  });

  it("위치를 못 찾은 주석은 orphans 로 분리하고 메모는 보존한다", () => {
    const good = ann({ id: "g", anchor: makeAnchor(plain, 0, 9) });
    const lost = ann({
      id: "L",
      memo: "잃지 마",
      anchor: { quote: "사라진 텍스트", prefix: "", suffix: "" },
    });
    const { segments, orphans } = segmentText(plain, [good, lost]);
    expect(orphans.map((o) => o.id)).toEqual(["L"]);
    expect(orphans[0].memo).toBe("잃지 마");
    expect(segments.some((s) => s.annotations.some((x) => x.id === "g"))).toBe(true);
  });
});
