import { describe, it, expect, afterAll } from "vitest";
import { Pool } from "pg";
import type { Concept, Question } from "./types";
import {
  loadQuestionsFromDb,
  loadConceptsFromDb,
  upsertQuestion,
  upsertConcept,
} from "./content-db";

// content-db round-trip (이슈 #26 AC). DATABASE_URL 없으면 skip — 무DB CI 는 그대로 그린.
// docker postgres + db/migrations(0003 포함) 적용 후:
//   DATABASE_URL=postgres://quizdeck:quizdeck@localhost:55432/quizdeck pnpm test

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("content-db round-trip (실 postgres 필요)", () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const examKey = `test/content_${Date.now()}`;

  const q1: Question = {
    qn: 1,
    topic: "📦 스토리지",
    q: "S3 질문 **굵게**",
    options: { A: "에이", B: "비" },
    answer: ["A", "B"],
    explanation: "해설",
    tip: "팁",
    page: 42,
    deeplink: "https://x",
  };
  const q2: Question = {
    qn: 2,
    topic: "네트워킹",
    q: "VPC",
    options: { A: "x" },
    answer: ["A"],
  }; // optional(explanation·tip·page·deeplink) 없음
  const c1: Concept = {
    cat: "네트워킹",
    svc: "S3",
    abbr: "S3",
    deff: "정의",
    detail: "상세",
    key: "핵심",
    when: "언제",
    trap: "함정",
    vs: "비교",
    cost: "비용",
    rel: [1, 2],
    reln: 5,
  };

  afterAll(async () => {
    await pool.query('delete from "question" where "exam_key" = $1', [examKey]);
    await pool.query('delete from "concept" where "exam_key" = $1', [examKey]);
    await pool.end();
  });

  it("Question upsert→load 가 정체성·필드를 정확히 round-trip 한다 (qn 순, optional 포함)", async () => {
    await upsertQuestion(pool, examKey, q1, "ko");
    await upsertQuestion(pool, examKey, q2, "ko");
    const got = await loadQuestionsFromDb(pool, examKey, "ko");
    expect(got).toEqual([q1, q2]);
  });

  it("Concept upsert→load 가 svc 식별로 round-trip 하고 ord 순서를 보존한다", async () => {
    const c2: Concept = { cat: "컴퓨팅", svc: "EC2", deff: "가상서버", key: "핵심2", when: "w", trap: "t", vs: "v" };
    // c1(S3)=ord 1, c2(EC2)=ord 0 → 로드는 ord 순(EC2, S3)이어야 한다(삽입/알파벳 순 아님).
    await upsertConcept(pool, examKey, c1, "ko", 1);
    await upsertConcept(pool, examKey, c2, "ko", 0);
    const got = await loadConceptsFromDb(pool, examKey, "ko");
    expect(got).toEqual([c2, c1]);
  });

  it("요청 언어 슬롯이 없으면 가용 언어로 폴백한다", async () => {
    const got = await loadQuestionsFromDb(pool, examKey, "en"); // en 없음 → ko 폴백
    expect(got.find((x) => x.qn === 1)?.q).toBe(q1.q);
  });

  it("재upsert 가 같은 (exam, qn) 한 행을 갱신하고 다른 언어 슬롯을 보존한다", async () => {
    await upsertQuestion(pool, examKey, { ...q1, q: "S3 수정됨" }, "ko"); // ko 갱신
    await upsertQuestion(pool, examKey, { ...q1, q: "S3 english" }, "en"); // en 추가

    const ko = await loadQuestionsFromDb(pool, examKey, "ko");
    const en = await loadQuestionsFromDb(pool, examKey, "en");
    expect(ko.find((x) => x.qn === 1)?.q).toBe("S3 수정됨");
    expect(en.find((x) => x.qn === 1)?.q).toBe("S3 english");

    const cnt = await pool.query<{ n: number }>(
      'select count(*)::int as n from "question" where "exam_key" = $1 and "qn" = 1',
      [examKey],
    );
    expect(cnt.rows[0].n).toBe(1); // 한 행만(중복 아님)
  });
});
