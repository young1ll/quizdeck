import { getPayload } from "payload";
import config from "../payload.config.ts";
import { pool } from "../lib/db.ts";

// 버전 행 백필 (ADR-0024 애던덤 — admin 목록 '결과없음' 사고). 드래프트 활성화(#114) 때
// 본 테이블 _status 는 published 로 백필했지만 **버전 테이블(_v)은 비어 있었다** — 서빙
// (draft:false, 본 테이블)은 멀쩡한데 admin 목록(draft:true, 최신 버전 조인)만 0건이 되는
// 원인. 각 문서를 무변경 재저장(publish)하면 Payload 가 published 버전 행을 만든다. 멱등 —
// 재실행해도 버전만 하나 더 쌓일 뿐(maxPerDoc 20 캡) 데이터는 불변.
// 실행: DATABASE_URL=… PAYLOAD_SECRET=… pnpm payload run cms/backfill-versions.ts

const payload = await getPayload({ config });

for (const collection of ["exams", "questions", "concepts"] as const) {
  // published 만 — 사용자가 admin 에서 만든 미완성 초안(필수 필드 미충족)은 게시 시도하면
  // 안 되고(ValidationError — 운영 실사), 초안은 autosave 가 이미 버전을 만들어 목록에 보인다.
  const { docs } = await payload.find({
    collection,
    where: { _status: { equals: "published" } },
    draft: false,
    pagination: false,
    depth: 0,
    overrideAccess: true,
  });
  // 이미 버전이 있는 문서는 건너뛴다 — 중단·재실행이 잦은 원격(터널) 실행에서 이어달리기.
  const table = { exams: "_exams_v", questions: "_questions_v", concepts: "_concepts_v" }[collection];
  const versioned = new Set(
    (await pool.query<{ parent_id: number }>(`select distinct parent_id from payload.${table}`)).rows.map(
      (r) => r.parent_id,
    ),
  );
  const todo = docs.filter((d) => !versioned.has(d.id as number));
  console.log(`${collection}: total=${docs.length} skip=${docs.length - todo.length} todo=${todo.length}`);
  let done = 0;
  for (const doc of todo) {
    await payload.update({ collection, id: doc.id, data: {}, depth: 0, overrideAccess: true });
    done++;
    if (done % 50 === 0) console.log(`${collection}: ${done}/${todo.length}`);
  }
  const after = await payload.find({
    collection,
    draft: true,
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  console.log(`${collection}: resaved=${done} draft-list-now=${after.totalDocs}`);
}
process.exit(0);
