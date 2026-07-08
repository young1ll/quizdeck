import { describe, it, expect } from "vitest";
import {
  nextQn,
  ordFor,
  mergeQuestion,
  mergeConcept,
  removeQuestion,
  removeConcept,
  setOptionValue,
  addOption,
  removeOption,
  toggleAnswer,
} from "./content-draft";
import type { Question, Concept } from "./types";
import type { LocalizedQuestion, LocalizedConcept } from "./content-localize";

// 편집기 도메인 결정 순수 테스트 (아키텍처 리뷰 C2) — 그동안 ContentEditor useState 클로저에 갇혀
// 미검증이던 채번·병합·옵션/정답 상태기계를 DB/React 없이 핀한다.

const q = (over: Partial<Question> = {}): Question => ({
  qn: 1,
  topic: "t",
  q: "질문",
  options: { A: "a", B: "b" },
  answer: ["A"],
  ...over,
});

const c = (over: Partial<Concept> = {}): Concept => ({
  cat: "c",
  svc: "s3",
  deff: "d",
  key: "k",
  when: "w",
  trap: "t",
  vs: "v",
  ...over,
});

describe("nextQn", () => {
  it("빈 목록이면 1", () => {
    expect(nextQn([])).toBe(1);
  });
  it("최대 qn + 1", () => {
    const items: LocalizedQuestion[] = [
      { qn: 3, answer: [], content: {} },
      { qn: 1, answer: [], content: {} },
    ];
    expect(nextQn(items)).toBe(4);
  });
});

describe("ordFor", () => {
  const items: LocalizedConcept[] = [
    { svc: "a", content: {} },
    { svc: "b", content: {} },
  ];
  it("기존 svc 는 현재 index", () => {
    expect(ordFor(items, "b")).toBe(1);
  });
  it("신규 svc 는 끝(length)", () => {
    expect(ordFor(items, "z")).toBe(2);
  });
});

describe("mergeQuestion", () => {
  it("신규 문항 추가 + qn 정렬", () => {
    const items: LocalizedQuestion[] = [{ qn: 1, answer: ["A"], content: { ko: {} as never } }];
    const merged = mergeQuestion(items, q({ qn: 3 }), "ko");
    expect(merged.map((i) => i.qn)).toEqual([1, 3]);
  });
  it("다른 언어 슬롯 보존, editLang 슬롯만 갱신", () => {
    const items: LocalizedQuestion[] = [
      { qn: 1, answer: ["A"], content: { en: { topic: "T", q: "Q", options: { A: "a", B: "b" } } } },
    ];
    const merged = mergeQuestion(items, q({ qn: 1, q: "새질문" }), "ko");
    expect(merged[0].content.en).toEqual({ topic: "T", q: "Q", options: { A: "a", B: "b" } });
    expect(merged[0].content.ko?.q).toBe("새질문");
  });
  it("toQuestionSlot 재사용 — 파생 topicId 는 슬롯에 새지 않음", () => {
    const merged = mergeQuestion([], q({ qn: 1, topicId: "stable-id" }), "ko");
    expect(merged[0].content.ko).not.toHaveProperty("topicId");
  });
});

describe("mergeConcept", () => {
  it("ord 위치에 삽입", () => {
    const items: LocalizedConcept[] = [
      { svc: "a", content: {} },
      { svc: "b", content: {} },
    ];
    const merged = mergeConcept(items, c({ svc: "z" }), "ko", 1);
    expect(merged.map((i) => i.svc)).toEqual(["a", "z", "b"]);
  });
  it("다른 언어 슬롯 보존", () => {
    const items: LocalizedConcept[] = [{ svc: "s3", content: { en: { cat: "C" } as never } }];
    const merged = mergeConcept(items, c({ svc: "s3" }), "ko", 0);
    expect(merged[0].content.en).toEqual({ cat: "C" });
    expect(merged[0].content.ko).toBeDefined();
  });
});

describe("remove*", () => {
  it("removeQuestion 은 qn 필터", () => {
    const items: LocalizedQuestion[] = [
      { qn: 1, answer: [], content: {} },
      { qn: 2, answer: [], content: {} },
    ];
    expect(removeQuestion(items, 1).map((i) => i.qn)).toEqual([2]);
  });
  it("removeConcept 은 svc 필터", () => {
    const items: LocalizedConcept[] = [
      { svc: "a", content: {} },
      { svc: "b", content: {} },
    ];
    expect(removeConcept(items, "a").map((i) => i.svc)).toEqual(["b"]);
  });
});

describe("draft 변환", () => {
  it("setOptionValue 는 값만 갱신", () => {
    expect(setOptionValue(q(), "A", "새값").options).toEqual({ A: "새값", B: "b" });
  });
  it("addOption 은 다음 글자를 빈 값으로", () => {
    expect(addOption(q()).options).toEqual({ A: "a", B: "b", C: "" });
  });
  it("removeOption 은 보기 제거 + 정답 prune", () => {
    const d = removeOption(q({ options: { A: "a", B: "b" }, answer: ["A", "B"] }), "B");
    expect(d.options).toEqual({ A: "a" });
    expect(d.answer).toEqual(["A"]); // B 가 정답에서도 빠짐
  });
  it("toggleAnswer 는 추가/제거 토글", () => {
    expect(toggleAnswer(q({ answer: ["A"] }), "B").answer).toEqual(["A", "B"]);
    expect(toggleAnswer(q({ answer: ["A", "B"] }), "B").answer).toEqual(["A"]);
  });
});
