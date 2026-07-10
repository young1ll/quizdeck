import type { Pool } from "pg";
import type { IconImageMime } from "./icon-image";

// 문제집 아이콘 오버라이드 (ADR-0023 + 이미지 애던덤). 카탈로그(파일 meta.json, 빌드-세이프 —
// ADR-0005 A)는 그대로 두고 아이콘만 DB 오버레이 — admin 이 재배포 없이 수정한다. 행 존재 =
// 오버라이드(이모지 **또는** 이미지, 0010 XOR 제약), 삭제 = 파일 기본값 복귀. 병합은 순수
// applyIconOverrides(lib/catalog)가 소유 — 이미지 행도 **서빙 URL 문자열**로 돌려주므로 병합·표시
// 배관이 문자열 하나로 유지된다(<ExamIcon> 이 URL/이모지를 구분 렌더).

export async function loadIconOverrides(pool: Pool): Promise<Record<string, string>> {
  const r = await pool.query<{ exam_key: string; icon: string | null; v: string | null }>(
    `select "exam_key", "icon",
            case when "image" is not null
                 then (extract(epoch from "updated_at"))::bigint::text end as v
       from "exam_icon_override"`,
  );
  return Object.fromEntries(
    r.rows.map((row) => [
      row.exam_key,
      // 이미지 행 → 공개 서빙 라우트 URL(?v= 로 immutable 캐시 무효화). 이모지 행 → 그대로.
      row.v !== null ? `/api/exam-icon/${row.exam_key}/?v=${row.v}` : row.icon!,
    ]),
  );
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
            set "icon" = excluded."icon", "image" = null, "mime" = null, "updated_at" = now()`,
    [examKey, icon],
  );
}

/** 이미지 오버라이드 저장 — 이모지 오버라이드를 대체한다(XOR). 검증은 호출부(parseIconImage) 선행. */
export async function upsertIconImage(
  pool: Pool,
  examKey: string,
  image: Uint8Array,
  mime: IconImageMime,
): Promise<void> {
  await pool.query(
    `insert into "exam_icon_override" ("exam_key","image","mime","updated_at")
          values ($1, $2, $3, now())
     on conflict ("exam_key") do update
            set "image" = excluded."image", "mime" = excluded."mime", "icon" = null, "updated_at" = now()`,
    [examKey, Buffer.from(image), mime],
  );
}

/** 서빙 라우트용 단건 조회 — 이미지 행이 아니면 null. */
export async function getIconImage(
  pool: Pool,
  examKey: string,
): Promise<{ image: Buffer; mime: string } | null> {
  const r = await pool.query<{ image: Buffer | null; mime: string | null }>(
    `select "image","mime" from "exam_icon_override" where "exam_key" = $1`,
    [examKey],
  );
  const row = r.rows[0];
  if (!row?.image || !row.mime) return null;
  return { image: row.image, mime: row.mime };
}

/** 오버라이드 제거 — 파일(meta.json) 기본값으로 복귀. */
export async function deleteIconOverride(pool: Pool, examKey: string): Promise<void> {
  await pool.query(`delete from "exam_icon_override" where "exam_key" = $1`, [examKey]);
}
