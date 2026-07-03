import { describe, it, expect } from "vitest";
import { buildHeaderModel, examRoutes, type HeaderContext } from "./header-model";
import type { ExamMeta } from "./types";

const meta = { provider: "aws", slug: "sap-c02", code: "SAP-C02" } as ExamMeta;

const ctx = (patch: Partial<HeaderContext>): HeaderContext => ({
  meta,
  phase: "setup",
  isOnQuizRoute: false,
  isAdmin: false,
  current: null,
  exam: false,
  timeLeft: null,
  ...patch,
});

describe("examRoutes (exam URL 단일 출처)", () => {
  it("hub·search·admin 을 provider/slug 에서 낸다", () => {
    expect(examRoutes(meta)).toEqual({
      hub: "/aws/sap-c02",
      search: "/aws/sap-c02/search",
      admin: "/admin/aws/sap-c02",
    });
  });
});

describe("buildHeaderModel (3단 적응 결정)", () => {
  it("퀴즈 active(+/quiz 라우트+세션) → quiz focus chrome", () => {
    const m = buildHeaderModel(ctx({ phase: "active", isOnQuizRoute: true, current: { idx: 2, total: 10 } }));
    expect(m).toEqual({ kind: "quiz", progress: { position: 3, total: 10 }, timer: null });
  });

  it("시험 모드면 타이머(음수는 0으로 클램프)", () => {
    const m = buildHeaderModel(
      ctx({ phase: "active", isOnQuizRoute: true, current: { idx: 0, total: 5 }, exam: true, timeLeft: -3 }),
    );
    expect(m).toEqual({ kind: "quiz", progress: { position: 1, total: 5 }, timer: { sec: 0 } });
  });

  it("퀴즈 active 라도 /quiz 라우트가 아니면 exam 브레드크럼(참조 라우트 구별)", () => {
    const m = buildHeaderModel(ctx({ phase: "active", isOnQuizRoute: false, current: { idx: 0, total: 5 } }));
    expect(m.kind).toBe("exam");
  });

  it("exam 브레드크럼 — 시험코드·hub·search, admin 은 role 있을 때만", () => {
    expect(buildHeaderModel(ctx({ isAdmin: false }))).toEqual({
      kind: "exam",
      examCode: "SAP-C02",
      hubHref: "/aws/sap-c02",
      searchHref: "/aws/sap-c02/search",
      adminHref: null,
    });
    expect(buildHeaderModel(ctx({ isAdmin: true })).kind).toBe("exam");
    expect((buildHeaderModel(ctx({ isAdmin: true })) as { adminHref: string }).adminHref).toBe(
      "/admin/aws/sap-c02",
    );
  });
});
