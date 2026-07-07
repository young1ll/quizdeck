import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import { PUT, DELETE } from "./route";
import { auth } from "@/lib/auth";
import { upsertQuestion, upsertConcept, deleteQuestion, deleteConcept } from "@/lib/content-db";
import type { Question, Concept } from "@/lib/types";

// route 의 DB 무관 단위 테스트 (아키텍처 리뷰 C1). 세션 해석 + content-db 만 모킹하면 인가(403)·봉투
// 거절(400)·op 가드(400)·dispatch(어느 db 함수를 부르나)가 postgres 없이 검증된다 — DATABASE_URL 없는
// CI 에서도 항상 실행(progress/annotations route.test 대칭, 그동안 admin/content 엔 없던 tier).
// 실 read/write·세션 스코프 round-trip 은 route.integration.test.ts 가 실 postgres 로 증명.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/lib/content-db", () => ({
  upsertQuestion: vi.fn(),
  upsertConcept: vi.fn(),
  deleteQuestion: vi.fn(),
  deleteConcept: vi.fn(),
}));

const BASE = "http://localhost:3000/api/admin/content";
const getSession = auth.api.getSession as unknown as Mock;

const validQ: Question = { qn: 1, topic: "t", q: "질문", options: { A: "a", B: "b" }, answer: ["A"] };
const validC: Concept = { cat: "c", svc: "s3", deff: "d", key: "k", when: "w", trap: "t", vs: "v" };

function req(method: "PUT" | "DELETE", body: unknown): Request {
  return new Request(BASE, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  getSession.mockReset();
  (upsertQuestion as Mock).mockReset();
  (upsertConcept as Mock).mockReset();
  (deleteQuestion as Mock).mockReset();
  (deleteConcept as Mock).mockReset();
});

describe("/api/admin/content — 인가", () => {
  it("미인증(세션 없음) PUT 은 403 (변경 시도 전 차단)", async () => {
    getSession.mockResolvedValue(null);
    const res = await PUT(req("PUT", { kind: "upsert-question", examKey: "aws/x", lang: "ko", question: validQ }));
    expect(res.status).toBe(403);
    expect(upsertQuestion).not.toHaveBeenCalled();
  });

  it("비admin 세션 PUT 은 403", async () => {
    getSession.mockResolvedValue({ user: { id: "u1", email: "u@x", role: "user" } });
    const res = await PUT(req("PUT", { kind: "upsert-question", examKey: "aws/x", lang: "ko", question: validQ }));
    expect(res.status).toBe(403);
  });
});

describe("/api/admin/content — dispatch·검증 (admin)", () => {
  beforeEach(() => {
    getSession.mockResolvedValue({ user: { id: "a1", email: "a@x", role: "admin" } });
  });

  it("upsert-question 유효 → 204 + upsertQuestion(examKey, question, lang)", async () => {
    const res = await PUT(req("PUT", { kind: "upsert-question", examKey: "aws/x", lang: "ko", question: validQ }));
    expect(res.status).toBe(204);
    expect(upsertQuestion).toHaveBeenCalledWith(expect.anything(), "aws/x", validQ, "ko");
  });

  it("upsert-concept 유효 → 204 + upsertConcept(examKey, concept, lang, ord)", async () => {
    const res = await PUT(req("PUT", { kind: "upsert-concept", examKey: "aws/x", lang: "ko", ord: 2, concept: validC }));
    expect(res.status).toBe(204);
    expect(upsertConcept).toHaveBeenCalledWith(expect.anything(), "aws/x", validC, "ko", 2);
  });

  it("정답 ⊂ options 위반 → 400 + db 미호출", async () => {
    const res = await PUT(
      req("PUT", { kind: "upsert-question", examKey: "aws/x", lang: "ko", question: { ...validQ, answer: ["Z"] } }),
    );
    expect(res.status).toBe(400);
    expect(upsertQuestion).not.toHaveBeenCalled();
  });

  it("delete kind 가 PUT 으로 오면 400 (op 가드)", async () => {
    const res = await PUT(req("PUT", { kind: "delete-question", examKey: "aws/x", qn: 1 }));
    expect(res.status).toBe(400);
    expect(deleteQuestion).not.toHaveBeenCalled();
  });

  it("본문이 JSON 이 아니면 400", async () => {
    const bad = new Request(BASE, { method: "PUT", headers: { "content-type": "application/json" }, body: "not json" });
    const res = await PUT(bad);
    expect(res.status).toBe(400);
  });

  it("delete-question 유효 → 204 + deleteQuestion(examKey, qn)", async () => {
    const res = await DELETE(req("DELETE", { kind: "delete-question", examKey: "aws/x", qn: 3 }));
    expect(res.status).toBe(204);
    expect(deleteQuestion).toHaveBeenCalledWith(expect.anything(), "aws/x", 3);
  });

  it("delete-concept 유효 → 204 + deleteConcept(examKey, svc)", async () => {
    const res = await DELETE(req("DELETE", { kind: "delete-concept", examKey: "aws/x", svc: "s3" }));
    expect(res.status).toBe(204);
    expect(deleteConcept).toHaveBeenCalledWith(expect.anything(), "aws/x", "s3");
  });

  it("upsert kind 가 DELETE 로 오면 400 (op 가드)", async () => {
    const res = await DELETE(req("DELETE", { kind: "upsert-question", examKey: "aws/x", lang: "ko", question: validQ }));
    expect(res.status).toBe(400);
    expect(deleteQuestion).not.toHaveBeenCalled();
  });
});
