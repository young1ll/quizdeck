import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { pool } from "./db";
import {
  deleteAnnotation,
  listAnnotations,
  upsertAnnotation,
} from "./annotation-db";
import type { Annotation } from "./annotation";

// 주석 CRUD 의 세션 스코프·탈취 가드를 실 postgres 로 검증한다 (이슈 #29 보안 AC). DATABASE_URL
// 없으면 skip — 무DB CI 는 그대로 그린.
//   DATABASE_URL=... pnpm test
const hasDb = Boolean(process.env.DATABASE_URL);
const EXAM = "test/anno";
const A = `learnerA_${Date.now()}`;
const B = `learnerB_${Date.now()}`;

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

describe.skipIf(!hasDb)("annotation-db (실 postgres 필요)", () => {
  beforeAll(async () => {
    // annotation.learner_id 는 user(id) FK(0006). 두 Learner 의 user 행을 먼저 만든다.
    await pool.query(`delete from "user" where "id" in ($1,$2)`, [A, B]);
    await pool.query(
      `insert into "user" ("id","name","email","emailVerified")
        values ($1,'A',$2,true), ($3,'B',$4,true)`,
      [A, `${A}@example.com`, B, `${B}@example.com`],
    );
  });
  afterAll(async () => {
    // user 삭제 → FK cascade 로 그 Learner 의 annotation 도 정리.
    await pool.query(`delete from "user" where "id" in ($1,$2)`, [A, B]);
  });

  it("upsert→list round-trip, 그리고 다른 learner 의 주석은 보이지 않는다", async () => {
    await upsertAnnotation(pool, A, EXAM, mk(`${A}-1`, { memo: "A 메모" }));
    await upsertAnnotation(pool, B, EXAM, mk(`${B}-1`));
    const listA = await listAnnotations(pool, A, EXAM);
    expect(listA.map((x) => x.id)).toEqual([`${A}-1`]);
    expect(listA[0].memo).toBe("A 메모");
    expect(listA[0].updatedAt).toBeTypeOf("number");
  });

  it("upsert 는 같은 id 를 갱신한다(중복 생성 아님)", async () => {
    await upsertAnnotation(pool, A, EXAM, mk(`${A}-1`, { kind: "underline", memo: "고침" }));
    const listA = await listAnnotations(pool, A, EXAM);
    const row = listA.find((x) => x.id === `${A}-1`)!;
    expect(listA.filter((x) => x.id === `${A}-1`)).toHaveLength(1);
    expect(row.kind).toBe("underline");
    expect(row.memo).toBe("고침");
  });

  it("탈취 가드 — learner B 가 A 의 id 로 upsert 해도 A 의 행을 덮어쓰지 못한다", async () => {
    await upsertAnnotation(pool, B, EXAM, mk(`${A}-1`, { memo: "탈취 시도" }));
    const row = (await listAnnotations(pool, A, EXAM)).find((x) => x.id === `${A}-1`)!;
    expect(row.memo).toBe("고침"); // A 의 값 그대로 — 탈취 무효
    expect((await listAnnotations(pool, B, EXAM)).some((x) => x.id === `${A}-1`)).toBe(false);
  });

  it("delete 는 소유 learner 로 스코프 — 타인은 못 지운다", async () => {
    await deleteAnnotation(pool, B, `${A}-1`); // B 가 A 의 것 삭제 시도 → no-op
    expect((await listAnnotations(pool, A, EXAM)).some((x) => x.id === `${A}-1`)).toBe(true);
    await deleteAnnotation(pool, A, `${A}-1`); // 소유자는 삭제됨
    expect((await listAnnotations(pool, A, EXAM)).some((x) => x.id === `${A}-1`)).toBe(false);
  });
});
