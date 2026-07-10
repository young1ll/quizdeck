import type { Pool } from "pg";

// 문제집 아이콘 오버라이드 (ADR-0023). 카탈로그(파일 meta.json, 빌드-세이프 — ADR-0005 A)는 그대로
// 두고 아이콘만 DB 오버레이 — admin 이 재배포 없이 수정한다. 행 존재 = 오버라이드, 삭제 = 파일
// 기본값 복귀. 병합은 순수 applyIconOverrides(lib/catalog)가 소유, 여기는 CRUD 만.

export async function loadIconOverrides(pool: Pool): Promise<Record<string, string>> {
  const r = await pool.query<{ exam_key: string; icon: string }>(
    `select "exam_key","icon" from "exam_icon_override"`,
  );
  return Object.fromEntries(r.rows.map((row) => [row.exam_key, row.icon]));
}

export async function upsertIconOverride(
  pool: Pool,
  examKey: string,
  icon: string,
): Promise<void> {
  await pool.query(
    `insert into "exam_icon_override" ("exam_key","icon","updated_at")
          values ($1, $2, now())
     on conflict ("exam_key") do update
            set "icon" = excluded."icon", "updated_at" = now()`,
    [examKey, icon],
  );
}

/** 오버라이드 제거 — 파일(meta.json) 기본값으로 복귀. */
export async function deleteIconOverride(pool: Pool, examKey: string): Promise<void> {
  await pool.query(`delete from "exam_icon_override" where "exam_key" = $1`, [examKey]);
}
