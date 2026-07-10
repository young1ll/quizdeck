import { getPayload } from "payload";
import config from "../payload.config.ts";
import { pool } from "../lib/db.ts";
import { listExams, loadExamLocalized } from "../lib/content.ts";
import { applyIconOverrides } from "../lib/catalog.ts";
import { loadIconOverrides } from "../lib/exam-icon-db.ts";
import { listExamsFromPayload, loadExamLocalizedFromPayload } from "./read.ts";

// 이관 정합성 기계 검증 (ADR-0024 2단계) — "구 로더 출력 == 신 투영 출력". 수동 눈검증은
// 로케일 폴백 누락·필드 드롭을 못 잡는다(설계 합의 사항). 카탈로그(ExamSummary[], 아이콘
// 오버라이드 병합 포함)와 시험별 LocalizedExamData 전 섹션을 canonical JSON 으로 비교한다.
// 실행: DATABASE_URL=… PAYLOAD_SECRET=… pnpm payload run cms/verify-content.ts → exit 0/1

/** 키 정렬 canonical 직렬화 — 키 순서·undefined 차이를 무시하고 값만 비교한다. */
function canonical(v: unknown): string {
  return JSON.stringify(v, (_k, val) =>
    val && typeof val === "object" && !Array.isArray(val)
      ? Object.fromEntries(Object.entries(val as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : val,
  );
}

let failures = 0;

function compare(label: string, oldV: unknown, newV: unknown): void {
  const a = canonical(oldV);
  const b = canonical(newV);
  if (a === b) {
    console.log(`  ok   ${label}`);
    return;
  }
  failures++;
  console.error(`  DIFF ${label}`);
  // 배열이면 첫 불일치 원소를 짚는다 — 787개 문항에서 diff 위치를 바로 찾게.
  if (Array.isArray(oldV) && Array.isArray(newV)) {
    if (oldV.length !== newV.length) {
      console.error(`    length: old=${oldV.length} new=${newV.length}`);
    }
    for (let i = 0; i < Math.max(oldV.length, newV.length); i++) {
      if (canonical(oldV[i]) !== canonical(newV[i])) {
        console.error(`    first mismatch [${i}]:`);
        console.error(`      old: ${canonical(oldV[i])?.slice(0, 400)}`);
        console.error(`      new: ${canonical(newV[i])?.slice(0, 400)}`);
        break;
      }
    }
  } else {
    console.error(`    old: ${a?.slice(0, 400)}`);
    console.error(`    new: ${b?.slice(0, 400)}`);
  }
}

const payload = await getPayload({ config });

// ── 카탈로그 — 구: 파일 meta + 아이콘 오버라이드 병합(소비 RSC 와 동일 경로) ──
console.log("catalog:");
const oldCatalog = applyIconOverrides(listExams(), await loadIconOverrides(pool));
const newCatalog = await listExamsFromPayload(payload);
compare("exams (ExamSummary[])", oldCatalog, newCatalog);

// ── 시험별 전체 데이터 ──
for (const e of oldCatalog) {
  console.log(`${e.provider}/${e.slug}:`);
  const oldData = await loadExamLocalized(e.provider, e.slug);
  const newData = await loadExamLocalizedFromPayload(payload, e.provider, e.slug);
  if (!oldData || !newData) {
    failures++;
    console.error(`  DIFF load: old=${!!oldData} new=${!!newData}`);
    continue;
  }
  compare("meta", oldData.meta, newData.meta);
  compare("questions", oldData.questions, newData.questions);
  compare("concepts", oldData.concepts, newData.concepts);
  compare("diagrams", oldData.diagrams, newData.diagrams);
  compare("q2svc", oldData.q2svc, newData.q2svc);
  compare("icons", oldData.icons, newData.icons);
  compare("availableLangs", [...oldData.availableLangs].sort(), [...newData.availableLangs].sort());
}

if (failures) {
  console.error(`\nFAILED: ${failures} diff(s)`);
  process.exit(1);
}
console.log("\nVERIFIED: 구 로더 출력 == 신 투영 출력 (전 섹션 일치)");
process.exit(0);
