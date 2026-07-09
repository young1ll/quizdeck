import { describe, expect, it } from "vitest";
import {
  parseCollection,
  addItem,
  removeItem,
  hasItem,
  groupItemsByExam,
  COLLECTION_NAME_MAX,
  COLLECTION_ITEMS_MAX,
} from "./collection";

const item = (examKey: string, qn: number) => ({ examKey, qn });

describe("parseCollection (경계 검증)", () => {
  const valid = {
    id: "col-1",
    name: "약점 모음",
    items: [item("aws/saa-c03", 7), item("aws/sap-c02", 101)],
    updatedAt: 1000,
  };

  it("유효한 컬렉션을 통과시킨다(cross-Exam items)", () => {
    expect(parseCollection(valid)).toEqual(valid);
  });

  it("id·name 누락/빈 값·객체 아님은 null", () => {
    expect(parseCollection(null)).toBeNull();
    expect(parseCollection({ ...valid, id: "" })).toBeNull();
    expect(parseCollection({ ...valid, name: "  " })).toBeNull();
    expect(parseCollection({ ...valid, name: undefined })).toBeNull();
  });

  it("이름은 trim + 길이 한도", () => {
    expect(parseCollection({ ...valid, name: "  a  " })!.name).toBe("a");
    expect(parseCollection({ ...valid, name: "x".repeat(COLLECTION_NAME_MAX + 1) })).toBeNull();
  });

  it("items 형태 불량(qn 비정수/음수·examKey 빈 값)은 null", () => {
    expect(parseCollection({ ...valid, items: [{ examKey: "aws/x", qn: 1.5 }] })).toBeNull();
    expect(parseCollection({ ...valid, items: [{ examKey: "", qn: 1 }] })).toBeNull();
    expect(parseCollection({ ...valid, items: "not-array" })).toBeNull();
  });

  it("items 한도 초과는 null", () => {
    const many = Array.from({ length: COLLECTION_ITEMS_MAX + 1 }, (_, i) => item("aws/x", i + 1));
    expect(parseCollection({ ...valid, items: many })).toBeNull();
  });

  it("(examKey, qn) 중복은 첫 등장만 남겨 정규화 — 같은 qn 이라도 다른 시험이면 별개", () => {
    const c = parseCollection({
      ...valid,
      items: [item("aws/a", 1), item("aws/a", 1), item("aws/b", 1)],
    })!;
    expect(c.items).toEqual([item("aws/a", 1), item("aws/b", 1)]);
  });
});

describe("addItem / removeItem / hasItem (중복 없음·순서 보존)", () => {
  const base = [item("aws/a", 1), item("aws/b", 2)];

  it("담기 — 새 항목은 끝에, 이미 있으면 그대로", () => {
    expect(addItem(base, item("aws/c", 3)).at(-1)).toEqual(item("aws/c", 3));
    expect(addItem(base, item("aws/a", 1))).toBe(base); // 참조 동일 = 변화 없음
  });

  it("빼기 — (examKey, qn) 정확 일치만 제거", () => {
    expect(removeItem(base, item("aws/a", 1))).toEqual([item("aws/b", 2)]);
    expect(removeItem(base, item("aws/a", 2))).toEqual(base); // 다른 qn — 무변
  });

  it("hasItem 은 시험 경계를 존중한다", () => {
    expect(hasItem(base, item("aws/a", 1))).toBe(true);
    expect(hasItem(base, item("aws/b", 1))).toBe(false);
  });
});

describe("groupItemsByExam (시험별 그룹 — S1 시험별 풀기·S2 혼합 큐 공유)", () => {
  it("첫 등장 순으로 시험을 묶고 qn 순서를 보존한다", () => {
    const groups = groupItemsByExam([
      item("aws/saa-c03", 7),
      item("aws/sap-c02", 101),
      item("aws/saa-c03", 20),
    ]);
    expect(groups).toEqual([
      { examKey: "aws/saa-c03", qns: [7, 20] },
      { examKey: "aws/sap-c02", qns: [101] },
    ]);
  });

  it("빈 items 는 빈 그룹", () => {
    expect(groupItemsByExam([])).toEqual([]);
  });
});
