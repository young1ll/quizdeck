// Question·Concept 콘텐츠를 content/ JSON → DB 로 seed 한다 (이슈 #26 / ADR-0005 A).
// idempotent: 같은 (exam_key, qn|svc) 를 upsert 하며 다른 언어 슬롯은 보존한다(content || excluded).
// content-db.ts(load/upsert)와 같은 SQL 을 쓴다 — 이 .mjs 는 TS import 불가라 의도적으로 중복.
//
// 실행(DB 가 닿는 호스트 — DB VM 접근은 k3s 노드만; db/migrations/README.md 참고):
//   DATABASE_URL=postgres://quizdeck:…@<DB_VM_LAN_IP>:5432/quizdeck node db/seed-content.mjs
// 0003_content.sql 적용 후 실행한다.
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

const ROOT = path.join(process.cwd(), "content");

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

async function upsertQuestion(pool, examKey, q, lang) {
  const { qn, answer, ...rest } = q;
  await pool.query(
    `insert into "question" ("exam_key", "qn", "answer", "content")
          values ($1, $2, $3, $4::jsonb)
     on conflict ("exam_key", "qn")
          do update set "answer" = excluded."answer",
                        "content" = "question"."content" || excluded."content"`,
    [examKey, qn, answer, JSON.stringify({ [lang]: rest })],
  );
}

async function upsertConcept(pool, examKey, c, lang, ord) {
  const { svc, ...rest } = c;
  await pool.query(
    `insert into "concept" ("exam_key", "svc", "ord", "content")
          values ($1, $2, $3, $4::jsonb)
     on conflict ("exam_key", "svc")
          do update set "ord" = excluded."ord",
                        "content" = "concept"."content" || excluded."content"`,
    [examKey, svc, ord, JSON.stringify({ [lang]: rest })],
  );
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL 환경변수가 필요합니다.");
    process.exit(1);
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  let nq = 0;
  let nc = 0;

  for (const provider of fs.readdirSync(ROOT)) {
    const providerDir = path.join(ROOT, provider);
    if (!fs.statSync(providerDir).isDirectory()) continue;

    for (const slug of fs.readdirSync(providerDir)) {
      const dir = path.join(providerDir, slug);
      const metaPath = path.join(dir, "meta.json");
      if (!fs.existsSync(metaPath)) continue;

      const meta = readJSON(metaPath);
      const lang = meta.language;
      const examKey = `${provider}/${slug}`;
      const questions = readJSON(path.join(dir, "questions.json"));
      const concepts = readJSON(path.join(dir, "concepts.json"));

      for (const q of questions) {
        await upsertQuestion(pool, examKey, q, lang);
        nq++;
      }
      for (const [i, c] of concepts.entries()) {
        await upsertConcept(pool, examKey, c, lang, i); // ord = 파일 배열 인덱스(표시 순서 보존)
        nc++;
      }
      console.log(
        `seeded ${examKey} (${lang}): ${questions.length} questions, ${concepts.length} concepts`,
      );
    }
  }

  console.log(`done: ${nq} questions, ${nc} concepts`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
