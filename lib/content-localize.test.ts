import { describe, it, expect } from "vitest";
import type { Concept, Question } from "./types";
import {
  projectQuestion,
  projectConcept,
  availableLangs,
  questionForLang,
  conceptForLang,
  type LocalizedQuestion,
  type LocalizedConcept,
} from "./content-localize";

const lq: LocalizedQuestion = {
  qn: 7,
  answer: ["A", "B"],
  content: {
    ko: { topic: "스토리지", q: "S3 한글", options: { A: "에이", B: "비" }, explanation: "해설", tip: "팁" },
    en: { topic: "storage", q: "S3 english", options: { A: "aa", B: "bb" } },
  },
};

const lc: LocalizedConcept = {
  svc: "S3",
  content: {
    ko: { cat: "스토리지", deff: "정의", key: "핵심", when: "언제", trap: "함정", vs: "비교", rel: [1, 2], reln: 5 },
  },
};

describe("projectQuestion", () => {
  it("요청 언어 슬롯으로 투영하고 qn·answer 는 언어 무관으로 유지한다", () => {
    const ko = projectQuestion(lq, "ko");
    expect(ko).toEqual<Question>({
      qn: 7,
      answer: ["A", "B"],
      topic: "스토리지",
      topicId: "스토리지", // canonical 기본 = lang(ko) → 표시와 같음
      q: "S3 한글",
      options: { A: "에이", B: "비" },
      explanation: "해설",
      tip: "팁",
    });
    const en = projectQuestion(lq, "en");
    expect(en.qn).toBe(7);
    expect(en.answer).toEqual(["A", "B"]); // 정답은 언어 무관 — 토글해도 동일
    expect(en.q).toBe("S3 english");
    expect(en.explanation).toBeUndefined(); // en 슬롯엔 explanation 없음
  });

  it("canonicalLang 슬롯의 topic 을 안정 topicId 로 — 표시 언어와 무관(토글 불변)", () => {
    // ko 가 기본 언어(canonical=ko). en 으로 표시해도 topicId 는 ko topic(안정 키).
    const enView = projectQuestion(lq, "en", "ko");
    expect(enView.topic).toBe("storage"); // 표시 라벨 = en
    expect(enView.topicId).toBe("스토리지"); // id = canonical(ko) — 언어 무관
    const koView = projectQuestion(lq, "ko", "ko");
    expect(enView.topicId).toBe(koView.topicId); // 토글해도 같은 id → basePool 필터 생존
  });

  it("요청 언어 슬롯이 없으면 가용 언어로 폴백한다(빈 화면 없음)", () => {
    const only = { ...lq, content: { ko: lq.content.ko } };
    const en = projectQuestion(only, "en"); // en 없음 → ko
    expect(en.q).toBe("S3 한글");
  });
});

describe("projectConcept", () => {
  it("svc 를 유지하며 언어 슬롯으로 투영한다", () => {
    const ko = projectConcept(lc, "ko");
    expect(ko).toEqual<Concept>({
      svc: "S3",
      cat: "스토리지",
      deff: "정의",
      key: "핵심",
      when: "언제",
      trap: "함정",
      vs: "비교",
      rel: [1, 2],
      reln: 5,
    });
  });
});

describe("questionForLang (어드민 — 폴백 없음)", () => {
  it("그 언어 슬롯이 있으면 그대로 쓴다", () => {
    const ko = questionForLang(lq, "ko");
    expect(ko.q).toBe("S3 한글");
    expect(ko.answer).toEqual(["A", "B"]);
  });

  it("미번역 슬롯이면 다른 언어의 보기 키를 빈 값으로 시드하고 qn·answer 를 보존한다", () => {
    const koOnly: LocalizedQuestion = {
      qn: 3,
      answer: ["A", "B"],
      content: { ko: { topic: "t", q: "q", options: { A: "가", B: "나", C: "다" } } },
    };
    const en = questionForLang(koOnly, "en"); // en 슬롯 없음
    expect(en.qn).toBe(3);
    expect(en.answer).toEqual(["A", "B"]); // 정답 보존
    expect(en.q).toBe(""); // 미번역 — 빈 텍스트
    expect(Object.keys(en.options)).toEqual(["A", "B", "C"]); // 다른 슬롯 키 시드 → 정답 ⊂ options 유지
    expect(Object.values(en.options)).toEqual(["", "", ""]); // 값은 비움
  });

  it("슬롯이 하나도 없으면(완전 신규) 보기 A 하나", () => {
    const blank: LocalizedQuestion = { qn: 9, answer: [], content: {} };
    expect(Object.keys(questionForLang(blank, "ko").options)).toEqual(["A"]);
  });
});

describe("conceptForLang (어드민 — 폴백 없음)", () => {
  it("미번역 슬롯이면 svc 만 보존하고 텍스트는 빈다", () => {
    const c = conceptForLang(lc, "en"); // en 없음
    expect(c.svc).toBe("S3");
    expect(c.deff).toBe("");
    expect(c.cat).toBe("");
  });
});

describe("availableLangs", () => {
  it("모든 항목의 슬롯 키 합집합을 낸다(부분 번역 포함)", () => {
    const items = [
      { content: { ko: {}, en: {} } },
      { content: { ko: {} } }, // en 미번역
    ];
    expect(availableLangs(items).sort()).toEqual(["en", "ko"]);
  });
  it("빈 목록은 빈 배열", () => {
    expect(availableLangs([])).toEqual([]);
  });
});
