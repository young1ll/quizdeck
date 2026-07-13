import { getPayload } from "payload";
import config from "../payload.config.ts";

// payload → WordPress 이관 (ADR-0025 2단계 b). published 만 옮긴다 — 미완성 초안(사용자
// 작성 중)은 저작자의 것이라 건드리지 않는다. 멱등·이어달리기: WP 에 이미 있는
// examKey/(exam,qn)/(exam,svc)는 스킵 — 원격 REST 787건은 느릴 수 있어 중단·재실행 전제.
// 실행: DATABASE_URL=<터널 pg> PAYLOAD_SECRET=… WP_URL=https://wp.myquizdeck.com \
//       WP_APP_AUTH_FILE=/tmp/wp-app-auth pnpm payload run cms/migrate-to-wp.ts
// WP_APP_AUTH_FILE 내용: "user:application-password" 한 줄(채팅·git 밖).

import { readFileSync } from "node:fs";

const WP_URL = process.env.WP_URL ?? "https://wp.myquizdeck.com";
const AUTH = Buffer.from(
  (process.env.WP_APP_AUTH ?? readFileSync(process.env.WP_APP_AUTH_FILE ?? "/tmp/wp-app-auth", "utf-8")).trim(),
).toString("base64");

async function wp(path: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(`${WP_URL}/wp-json/wp/v2${path}`, {
    ...init,
    headers: { Authorization: `Basic ${AUTH}`, "Content-Type": "application/json", ...init?.headers },
  });
  const body = (await res.json()) as { code?: string; message?: string };
  if (!res.ok) throw new Error(`WP ${init?.method ?? "GET"} ${path} → ${res.status} ${body.code ?? ""} ${body.message ?? ""}`);
  return body;
}

async function wpAll(path: string): Promise<Array<{ id: number; qd: Record<string, unknown> }>> {
  const out: Array<{ id: number; qd: Record<string, unknown> }> = [];
  for (let page = 1; ; page++) {
    const rows = (await wp(`${path}per_page=100&page=${page}&status=publish,draft&context=edit`)) as Array<{ id: number; qd: Record<string, unknown> }>;
    out.push(...rows);
    if (rows.length < 100) return out;
  }
}

const payload = await getPayload({ config });

// ── 1) 문제집 ──
const wpExams = await wpAll("/qd-exams?");
const wpExamByKey = new Map(wpExams.map((e) => [String(e.qd.exam_key), e.id]));
const exams = await payload.find({
  collection: "exams",
  where: { _status: { equals: "published" } },
  draft: false,
  joins: false,
  pagination: false,
  depth: 0,
  overrideAccess: true,
});
const examWpId = new Map<number, number>(); // payload id → wp id
for (const e of exams.docs) {
  const key = e.examKey!;
  let wpId = wpExamByKey.get(key);
  if (!wpId) {
    const created = (await wp("/qd-exams", {
      method: "POST",
      body: JSON.stringify({
        title: e.name,
        status: "publish",
        qd: {
          provider: e.provider,
          slug: e.slug,
          provider_name: e.providerName,
          code: e.code,
          language: e.language,
          icon: e.icon ?? null,
          track_id: e.trackId ?? null,
          track_name: e.trackName ?? null,
          diagrams: e.diagrams ?? [],
          q2svc: e.q2svc ?? {},
          svc_icons: e.svcIcons ?? {},
        },
      }),
    })) as { id: number };
    wpId = created.id;
    console.log(`exam created: ${key} → wp#${wpId}`);
  }
  examWpId.set(e.id as number, wpId);
}

// ── 2) 문항 ──
const wpQuestions = await wpAll("/qd-questions?");
const wpQnSet = new Set(wpQuestions.map((q) => `${q.qd.exam_id}#${q.qd.qn}`));
let qDone = 0;
for (const [pExamId, wExamId] of examWpId) {
  const qs = await payload.find({
    collection: "questions",
    where: { and: [{ exam: { equals: pExamId } }, { _status: { equals: "published" } }] },
    draft: false,
    locale: "ko",
    sort: "qn",
    pagination: false,
    depth: 0,
    overrideAccess: true,
  });
  for (const q of qs.docs) {
    if (wpQnSet.has(`${wExamId}#${q.qn}`)) continue;
    await wp("/qd-questions", {
      method: "POST",
      body: JSON.stringify({
        status: "publish",
        qd: {
          exam_id: wExamId,
          qn: q.qn,
          topic: q.topic ?? null,
          q: q.q,
          options: (q.options ?? []).map((o) => ({ key: o.key, text: o.text })),
          answer: q.answer ?? [],
          explanation: q.explanation ?? null,
          tip: q.tip ?? null,
          page: q.page ?? null,
          deeplink: q.deeplink ?? null,
        },
      }),
    });
    if (++qDone % 50 === 0) console.log(`questions: ${qDone}`);
  }
}
console.log(`questions migrated(new): ${qDone}`);

// ── 3) 개념 ──
const wpConcepts = await wpAll("/qd-concepts?");
const wpSvcSet = new Set(wpConcepts.map((c) => `${c.qd.exam_id}#${c.qd.svc}`));
let cDone = 0;
for (const [pExamId, wExamId] of examWpId) {
  const cs = await payload.find({
    collection: "concepts",
    where: { and: [{ exam: { equals: pExamId } }, { _status: { equals: "published" } }] },
    draft: false,
    locale: "ko",
    sort: "ord",
    pagination: false,
    depth: 0,
    overrideAccess: true,
  });
  for (const c of cs.docs) {
    if (wpSvcSet.has(`${wExamId}#${c.svc}`)) continue;
    await wp("/qd-concepts", {
      method: "POST",
      body: JSON.stringify({
        status: "publish",
        qd: {
          exam_id: wExamId,
          svc: c.svc,
          ord: c.ord,
          cat: c.cat ?? null,
          abbr: c.abbr ?? null,
          deff: c.deff,
          key: c.key ?? null,
          when: c.when ?? null,
          trap: c.trap ?? null,
          vs: c.vs ?? null,
          detail: c.detail ?? null,
          cost: c.cost ?? null,
          rel: c.rel ?? [],
          reln: c.reln ?? null,
        },
      }),
    });
    if (++cDone % 50 === 0) console.log(`concepts: ${cDone}`);
  }
}
console.log(`concepts migrated(new): ${cDone}`);
console.log("done — 다음: cms/verify-wp.ts 로 구==신 diff 검증");
process.exit(0);
