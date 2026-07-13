import { getPayload } from "payload";
import config from "../payload.config.ts";
import { listExamsFromPayload, loadExamLocalizedFromPayload } from "./read.ts";

// 이관 정합성 기계 검증 (ADR-0025 2단계 b) — "구(payload) 서빙 출력 == 신(WP) 투영".
// payload 전환 때의 verify-content 와 같은 규율: 수동 눈검증은 필드 드롭을 못 잡는다.
// WP 읽기는 익명 REST(published) — 3단계 서빙이 쓸 표면 그대로를 검증한다.
// 실행: DATABASE_URL=<터널 pg> PAYLOAD_SECRET=… WP_URL=… pnpm payload run cms/verify-wp.ts

const WP_URL = process.env.WP_URL ?? "https://wp.myquizdeck.com";

interface WpRow {
  id: number;
  qd: Record<string, unknown>;
}

async function wpAll(path: string): Promise<WpRow[]> {
  const out: WpRow[] = [];
  for (let page = 1; ; page++) {
    const res = await fetch(`${WP_URL}/wp-json/wp/v2${path}per_page=100&page=${page}`);
    if (!res.ok) {
      if (res.status === 400 && page > 1) return out; // rest_post_invalid_page_number
      throw new Error(`WP GET ${path} p${page} → ${res.status}`);
    }
    const rows = (await res.json()) as WpRow[];
    out.push(...rows);
    if (rows.length < 100) return out;
  }
}

function canonical(v: unknown): string {
  return JSON.stringify(v, (_k, val) =>
    val && typeof val === "object" && !Array.isArray(val)
      ? Object.fromEntries(Object.entries(val as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : val,
  );
}

let failures = 0;
function compare(label: string, oldV: unknown, newV: unknown): void {
  if (canonical(oldV) === canonical(newV)) {
    console.log(`  ok   ${label}`);
    return;
  }
  failures++;
  console.error(`  DIFF ${label}`);
  if (Array.isArray(oldV) && Array.isArray(newV)) {
    if (oldV.length !== newV.length) console.error(`    length: old=${oldV.length} new=${newV.length}`);
    for (let i = 0; i < Math.max(oldV.length, newV.length); i++) {
      if (canonical(oldV[i]) !== canonical(newV[i])) {
        console.error(`    first mismatch [${i}]:\n      old: ${canonical(oldV[i])?.slice(0, 300)}\n      new: ${canonical(newV[i])?.slice(0, 300)}`);
        break;
      }
    }
  } else {
    console.error(`    old: ${canonical(oldV)?.slice(0, 300)}\n    new: ${canonical(newV)?.slice(0, 300)}`);
  }
}

const nul = <T>(v: T | null | undefined): T | null => (v === undefined ? null : v);
// PHP 는 빈 연관배열을 표현하지 못해 {} 가 [] 로 돌아온다 — 서빙 의미는 동일(항목 없음).
// object 계약 필드(q2svc·icons)에 한해 동치로 정규화한다. 3단계 서빙 클라이언트도 같은 정규화 필요.
const emptyObj = (v: unknown): unknown => (Array.isArray(v) && v.length === 0 ? {} : v);

const payload = await getPayload({ config });

// ── 문제집 ──
const oldExams = await listExamsFromPayload(payload);
const wpExams = await wpAll("/qd-exams?");
const wpExamById = new Map(wpExams.map((e) => [e.id, e]));
compare(
  "exams(핵심 필드)",
  oldExams.map((e) => ({
    key: `${e.provider}/${e.slug}`,
    name: e.name,
    code: e.code,
    icon: nul(e.icon),
    track: e.track ? { id: e.track.id, name: e.track.name } : null,
  })),
  wpExams
    .map((e) => ({
      key: String(e.qd.exam_key),
      name: String(e.qd.name),
      code: String(e.qd.code),
      icon: nul(e.qd.icon as string | null),
      track: e.qd.track_id ? { id: e.qd.track_id, name: e.qd.track_name ?? "" } : null,
    }))
    .sort((a, b) => a.code.localeCompare(b.code)),
);

// ── 시험별 문항·개념 + 코드성 산출물 ──
const wpQuestions = await wpAll("/qd-questions?");
const wpConcepts = await wpAll("/qd-concepts?");

for (const e of oldExams) {
  console.log(`${e.provider}/${e.slug}:`);
  const old = await loadExamLocalizedFromPayload(payload, e.provider, e.slug);
  const wpExam = wpExams.find((w) => w.qd.exam_key === `${e.provider}/${e.slug}`)!;

  compare("diagrams", old!.diagrams, wpExam.qd.diagrams);
  compare("q2svc", emptyObj(old!.q2svc), emptyObj(wpExam.qd.q2svc));
  compare("icons", emptyObj(old!.icons), emptyObj(wpExam.qd.svc_icons));

  const oldQ = old!.questions.map((q) => {
    const s = q.content.ko as Record<string, unknown>;
    return {
      qn: q.qn,
      answer: q.answer,
      topic: nul(s.topic),
      q: s.q,
      options: s.options,
      explanation: nul(s.explanation),
      tip: nul(s.tip),
      page: nul(s.page),
      deeplink: nul(s.deeplink),
    };
  });
  const newQ = wpQuestions
    .filter((w) => w.qd.exam_id === wpExam.id)
    .map((w) => ({
      qn: w.qd.qn,
      answer: w.qd.answer,
      topic: nul(w.qd.topic),
      q: w.qd.q,
      options: Object.fromEntries(((w.qd.options as Array<{ key: string; text: string }>) ?? []).map((o) => [o.key, o.text])),
      explanation: nul(w.qd.explanation),
      tip: nul(w.qd.tip),
      page: nul(w.qd.page),
      deeplink: nul(w.qd.deeplink),
    }))
    .sort((a, b) => (a.qn as number) - (b.qn as number));
  compare(`questions(${oldQ.length})`, oldQ, newQ);

  const oldC = old!.concepts.map((c, i) => {
    const s = c.content.ko as Record<string, unknown>;
    return {
      svc: c.svc,
      ord: i, // 구 투영은 ord 순 정렬만 보장 — 값 비교는 정렬 위치로
      cat: nul(s.cat),
      abbr: nul(s.abbr),
      deff: s.deff,
      key: nul(s.key),
      when: nul(s.when),
      trap: nul(s.trap),
      vs: nul(s.vs),
      detail: nul(s.detail),
      cost: nul(s.cost),
      rel: s.rel ?? [],
      reln: nul(s.reln),
    };
  });
  const newC = wpConcepts
    .filter((w) => w.qd.exam_id === wpExam.id)
    .sort((a, b) => (a.qd.ord as number) - (b.qd.ord as number))
    .map((w, i) => ({
      svc: w.qd.svc,
      ord: i,
      cat: nul(w.qd.cat),
      abbr: nul(w.qd.abbr),
      deff: w.qd.deff,
      key: nul(w.qd.key),
      when: nul(w.qd.when),
      trap: nul(w.qd.trap),
      vs: nul(w.qd.vs),
      detail: nul(w.qd.detail),
      cost: nul(w.qd.cost),
      rel: w.qd.rel ?? [],
      reln: nul(w.qd.reln),
    }));
  compare(`concepts(${oldC.length})`, oldC, newC);
}

if (failures) {
  console.error(`\nFAILED: ${failures} diff(s)`);
  process.exit(1);
}
console.log("\nVERIFIED: payload 서빙 출력 == WP 투영 (전 섹션 일치)");
process.exit(0);
