import type { Pool } from "pg";

// 문제집 아이콘 오버라이드 **읽기** (ADR-0023 — ADR-0024 3단계로 폐기 궤도). 서빙은 Payload
// (exams.icon)로 전환됐고, 이 로더는 cms/verify-content.ts 의 "구 로더 출력" 재구성에만 남아
// 있다 — 쓰기(upsert/이미지)와 공개 서빙 라우트는 구 어드민과 함께 제거됨. 테이블 drop 은 4단계.
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
      // 이미지 행 → (제거된) 공개 서빙 라우트 URL 형태 — 현 데이터 0행, 발견 시 verify 가 diff 로 드러낸다.
      row.v !== null ? `/api/exam-icon/${row.exam_key}/?v=${row.v}` : row.icon!,
    ]),
  );
}
