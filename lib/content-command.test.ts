import { describe, it, expect } from "vitest";
import { parseContentCommand } from "./content-command";
import type { Question, Concept } from "./types";

// content-command 배선 봉투 — 순수·무-DB 로 디스패치·필드가드·leaf검증을 핀한다. 그동안 이 불변식
// (특히 정답 ⊂ options)은 admin/content route.integration.test 의 skipIf(!DATABASE_URL) 뒤에만 있어
// 무-DB CI 에서 미검증이었다(아키텍처 리뷰 content-command).

const validQ: Question = { qn: 1, topic: "t", q: "질문", options: { A: "a", B: "b" }, answer: ["A"] };
const validC: Concept = { cat: "c", svc: "s3", deff: "d", key: "k", when: "w", trap: "t", vs: "v" };

describe("parseContentCommand", () => {
  describe("upsert-question", () => {
    it("유효 command 를 그대로 통과", () => {
      const cmd = { kind: "upsert-question", examKey: "aws/sap", lang: "ko", question: validQ };
      expect(parseContentCommand(cmd)).toEqual(cmd);
    });
    it("정답이 options 에 없으면 거절 (마키 불변식)", () => {
      const r = parseContentCommand({
        kind: "upsert-question",
        examKey: "aws/sap",
        lang: "ko",
        question: { ...validQ, answer: ["Z"] },
      });
      expect(r).toHaveProperty("error");
    });
    it("lang 누락 거절", () => {
      expect(
        parseContentCommand({ kind: "upsert-question", examKey: "aws/sap", question: validQ }),
      ).toHaveProperty("error");
    });
    it("examKey 누락 거절", () => {
      expect(
        parseContentCommand({ kind: "upsert-question", lang: "ko", question: validQ }),
      ).toHaveProperty("error");
    });
  });

  describe("upsert-concept", () => {
    it("유효 command 통과", () => {
      const cmd = { kind: "upsert-concept", examKey: "aws/sap", lang: "ko", ord: 0, concept: validC };
      expect(parseContentCommand(cmd)).toEqual(cmd);
    });
    it("ord 누락·음수·비정수 거절", () => {
      const base = { kind: "upsert-concept", examKey: "aws/sap", lang: "ko", concept: validC };
      expect(parseContentCommand(base)).toHaveProperty("error");
      expect(parseContentCommand({ ...base, ord: -1 })).toHaveProperty("error");
      expect(parseContentCommand({ ...base, ord: 1.5 })).toHaveProperty("error");
    });
    it("필수 필드 없는 concept 거절", () => {
      expect(
        parseContentCommand({
          kind: "upsert-concept",
          examKey: "aws/sap",
          lang: "ko",
          ord: 0,
          concept: { ...validC, deff: "" },
        }),
      ).toHaveProperty("error");
    });
  });

  describe("delete-question", () => {
    it("유효 통과", () => {
      const cmd = { kind: "delete-question", examKey: "aws/sap", qn: 3 };
      expect(parseContentCommand(cmd)).toEqual(cmd);
    });
    it("qn 비정수·누락 거절", () => {
      expect(
        parseContentCommand({ kind: "delete-question", examKey: "aws/sap", qn: "3" }),
      ).toHaveProperty("error");
      expect(parseContentCommand({ kind: "delete-question", examKey: "aws/sap" })).toHaveProperty(
        "error",
      );
    });
  });

  describe("delete-concept", () => {
    it("유효 통과", () => {
      const cmd = { kind: "delete-concept", examKey: "aws/sap", svc: "s3" };
      expect(parseContentCommand(cmd)).toEqual(cmd);
    });
    it("svc 누락 거절", () => {
      expect(parseContentCommand({ kind: "delete-concept", examKey: "aws/sap" })).toHaveProperty(
        "error",
      );
    });
  });

  describe("봉투", () => {
    it("미지 kind 거절", () => {
      expect(parseContentCommand({ kind: "frobnicate", examKey: "x" })).toHaveProperty("error");
    });
    it("객체 아님 거절", () => {
      expect(parseContentCommand(null)).toHaveProperty("error");
      expect(parseContentCommand("x")).toHaveProperty("error");
      expect(parseContentCommand([])).toHaveProperty("error");
    });
  });
});
