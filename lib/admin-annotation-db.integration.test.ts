import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { pool } from "./db";
import {
  adminDeleteAnnotation,
  adminUpdateAnnotation,
  getLearnerSummary,
  listAnnotationsByLearner,
  searchLearnersWithAnnotations,
} from "./admin-annotation-db";
import { listAnnotations, upsertAnnotation } from "./annotation-db";
import type { Annotation } from "./annotation";

// admin 주석 쿼리(ADR-0027)를 실 postgres 로 검증한다 — annotation-db.integration.test 와 같은
// 하니스(DATABASE_URL 없으면 skip, user 행 선삽입 + afterAll cascade 정리).
//   DATABASE_URL=... pnpm test
const hasDb = Boolean(process.env.DATABASE_URL);
const STAMP = Date.now();
const A = `adminTestA_${STAMP}`;
const B = `adminTestB_${STAMP}`;

const mk = (id: string, over: Partial<Annotation> = {}): Annotation => ({
  id,
  qn: 1,
  lang: "ko",
  field: "q",
  kind: "highlight",
  memo: null,
  anchor: { quote: "스토리지", prefix: "객체 ", suffix: "이다" },
  ...over,
});

describe.skipIf(!hasDb)("admin-annotation-db (실 postgres 필요)", () => {
  beforeAll(async () => {
    await pool.query(`delete from "user" where "id" in ($1,$2)`, [A, B]);
    await pool.query(
      `insert into "user" ("id","name","email","emailVerified")
        values ($1,'AdminTest A',$2,true), ($3,'AdminTest B',$4,false)`,
      [A, `${A}@example.com`, B, `${B}@example.com`],
    );
    // A: 두 시험에 걸친 주석 3개(정렬 검증용 역순 삽입), B: 0개(left join 검증용).
    await upsertAnnotation(pool, A, "test/z-exam", mk(`${A}-3`, { qn: 5 }));
    await upsertAnnotation(pool, A, "test/a-exam", mk(`${A}-2`, { qn: 9, field: "explanation" }));
    await upsertAnnotation(pool, A, "test/a-exam", mk(`${A}-1`, { qn: 2, memo: "원래 메모" }));
  });
  afterAll(async () => {
    // user 삭제 → FK cascade(0006) 로 annotation 도 정리.
    await pool.query(`delete from "user" where "id" in ($1,$2)`, [A, B]);
  });

  it("검색 — 이메일 부분일치 + 주석 카운트·최근 활동, 주석 0개 회원도 나온다(left join)", async () => {
    const rows = await searchLearnersWithAnnotations(pool, `adminTestA_${STAMP}`);
    expect(rows.map((r) => r.id)).toEqual([A]);
    expect(rows[0].annotationCount).toBe(3);
    expect(rows[0].lastAnnotatedAt).toBeTypeOf("number");
    expect(rows[0].emailVerified).toBe(true);

    const byName = await searchLearnersWithAnnotations(pool, "AdminTest B");
    const b = byName.find((r) => r.id === B)!;
    expect(b.annotationCount).toBe(0);
    expect(b.lastAnnotatedAt).toBeNull();
  });

  it("getLearnerSummary — 있으면 요약, 없는 id 는 null", async () => {
    expect(await getLearnerSummary(pool, A)).toEqual({
      id: A,
      name: "AdminTest A",
      email: `${A}@example.com`,
      emailVerified: true,
    });
    expect(await getLearnerSummary(pool, `없는아이디_${STAMP}`)).toBeNull();
  });

  it("listAnnotationsByLearner — exam_key·qn 정렬로 전부, examKey 포함", async () => {
    const rows = await listAnnotationsByLearner(pool, A);
    expect(rows.map((r) => r.id)).toEqual([`${A}-1`, `${A}-2`, `${A}-3`]);
    expect(rows.map((r) => r.examKey)).toEqual(["test/a-exam", "test/a-exam", "test/z-exam"]);
    expect(rows[0].memo).toBe("원래 메모");
  });

  it("adminUpdateAnnotation — memo·kind 만 바뀌고 anchor/qn/field/learner_id 는 불변", async () => {
    const ok = await adminUpdateAnnotation(pool, `${A}-1`, { memo: "고친 메모", kind: "underline" });
    expect(ok).toBe(true);
    const row = (await listAnnotations(pool, A, "test/a-exam")).find((x) => x.id === `${A}-1`)!;
    expect(row.memo).toBe("고친 메모");
    expect(row.kind).toBe("underline");
    // 위치·소유 정보 불변 — learner 스코프 listAnnotations(A) 로 읽힌다는 것 자체가 learner_id 불변 증거.
    expect(row.qn).toBe(2);
    expect(row.field).toBe("q");
    expect(row.anchor).toEqual({ quote: "스토리지", prefix: "객체 ", suffix: "이다" });
  });

  it("adminUpdateAnnotation — memo null 은 메모 삭제, 없는 id 는 false", async () => {
    expect(await adminUpdateAnnotation(pool, `${A}-1`, { memo: null, kind: "underline" })).toBe(true);
    const row = (await listAnnotations(pool, A, "test/a-exam")).find((x) => x.id === `${A}-1`)!;
    expect(row.memo).toBeNull();
    expect(await adminUpdateAnnotation(pool, `없는id_${STAMP}`, { memo: null, kind: "highlight" })).toBe(false);
  });

  it("adminDeleteAnnotation — id 기준 삭제, 없는 id 는 false", async () => {
    expect(await adminDeleteAnnotation(pool, `${A}-3`)).toBe(true);
    expect((await listAnnotationsByLearner(pool, A)).map((r) => r.id)).toEqual([`${A}-1`, `${A}-2`]);
    expect(await adminDeleteAnnotation(pool, `${A}-3`)).toBe(false);
  });
});
