import { describe, expect, it } from "vitest";
import { groupExams, parseIcon, ICON_MAX } from "./catalog";
import type { ExamSummary } from "./types";

const ex = (over: Partial<ExamSummary>): ExamSummary => ({
  provider: "aws",
  providerName: "Amazon Web Services",
  slug: "x",
  code: "X",
  name: "X exam",
  questionCount: 1,
  ...over,
});

describe("groupExams", () => {
  it("track 이 있으면 track.id 로 묶고 라벨은 track.name", () => {
    const t = { id: "aws-solutions-architect", name: "AWS Solutions Architect" };
    const groups = groupExams([
      ex({ slug: "saa-c03", code: "SAA-C03", track: t }),
      ex({ slug: "sap-c02", code: "SAP-C02", track: t }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ id: "aws-solutions-architect", name: "AWS Solutions Architect" });
    expect(groups[0].exams.map((e) => e.slug)).toEqual(["saa-c03", "sap-c02"]);
  });

  it("track 없는 시험은 provider 로 폴백해 묶인다(하위 호환)", () => {
    const groups = groupExams([ex({ slug: "a" }), ex({ slug: "b" })]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ id: "aws", name: "Amazon Web Services" });
  });

  it("track 시험과 무-track 시험이 섞이면 별개 그룹 — 그룹 키는 id(라벨 아님)", () => {
    const t = { id: "aws-solutions-architect", name: "AWS Solutions Architect" };
    const groups = groupExams([
      ex({ slug: "saa-c03", track: t }),
      ex({ slug: "clf-c02", code: "CLF-C02" }), // 트랙 미지정
    ]);
    expect(groups.map((g) => g.id)).toEqual(["aws-solutions-architect", "aws"]);
  });

  it("같은 id 에 name 이 갈려도(파일 drift) 그룹은 하나 — 첫 등장 name 사용", () => {
    const groups = groupExams([
      ex({ slug: "a", track: { id: "t", name: "이름 A" } }),
      ex({ slug: "b", track: { id: "t", name: "이름 B(drift)" } }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe("이름 A");
  });

  it("빈 입력은 빈 그룹", () => {
    expect(groupExams([])).toEqual([]);
  });
});

describe("parseIcon (아이콘 경계 — ADR-0023, 컬렉션·문제집 오버라이드 공유)", () => {
  it("trim 후 유효하면 그대로, 빈 값·누락은 null(제거 의도)", () => {
    expect(parseIcon(" 🔥 ")).toBe("🔥");
    expect(parseIcon("")).toBeNull();
    expect(parseIcon("   ")).toBeNull();
    expect(parseIcon(undefined)).toBeNull();
    expect(parseIcon(null)).toBeNull();
  });

  it("ZWJ 조합 이모지(11 유닛)는 통과, 한도 초과·비문자열은 undefined(불량)", () => {
    expect(parseIcon("👨‍👩‍👧‍👦")).toBe("👨‍👩‍👧‍👦");
    expect(parseIcon("x".repeat(ICON_MAX + 1))).toBeUndefined();
    expect(parseIcon(7)).toBeUndefined();
    expect(parseIcon({})).toBeUndefined();
  });
});
