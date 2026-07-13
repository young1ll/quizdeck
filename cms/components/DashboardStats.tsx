import React from "react";
import type { ServerProps } from "payload";
import { pool } from "../../lib/db.ts";
import ActivityChart from "./ActivityChart.tsx";

// 운영 대시보드 위젯 (ADR-0024 확장 A) — /admin 첫 화면(beforeDashboard). WordPress 대시보드의
// 등가: 콘텐츠 규모·학습자 활동·배포 정보를 한눈에. 서버 컴포넌트 — Payload Local API(props.payload)
// + 공유 pg 풀(학습자 지표는 public 스키마 소유)로 읽는다. 조회 5개 수준 — admin 첫 화면 한정이라 저렴.

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "0.3rem 0.9rem 0.3rem 0",
  borderBottom: "1px solid var(--theme-elevation-150)",
  fontSize: "0.72rem",
  color: "var(--theme-elevation-600)",
  fontWeight: 500,
};
const td: React.CSSProperties = {
  padding: "0.3rem 0.9rem 0.3rem 0",
  borderBottom: "1px solid var(--theme-elevation-100)",
  fontSize: "0.82rem",
};

/** 시험별 요약 — 문제집 단위 콘텐츠·학습자 현황(대시보드 v3). */
async function ExamSummary({ payloadInstance }: { payloadInstance: ServerProps["payload"] }) {
  const exams = await payloadInstance.find({
    collection: "exams",
    where: { _status: { equals: "published" } },
    joins: false,
    pagination: false,
    depth: 0,
    overrideAccess: true,
  });
  const learners = await pool.query<{ exam_key: string; n: string }>(
    `select "exam_key", count(distinct "learner_id") n from "progress" group by "exam_key"`,
  );
  const byKey = new Map(learners.rows.map((r) => [r.exam_key, r.n]));
  const rows = await Promise.all(
    exams.docs.map(async (e) => {
      const [q, c] = await Promise.all([
        payloadInstance.count({
          collection: "questions",
          where: { and: [{ exam: { equals: e.id } }, { _status: { equals: "published" } }] },
          overrideAccess: true,
        }),
        payloadInstance.count({
          collection: "concepts",
          where: { and: [{ exam: { equals: e.id } }, { _status: { equals: "published" } }] },
          overrideAccess: true,
        }),
      ]);
      return { e, q: q.totalDocs, c: c.totalDocs, learners: byKey.get(e.examKey!) ?? "0" };
    }),
  );
  return (
    <div style={{ marginTop: "1.2rem" }}>
      <h3 style={{ fontSize: "0.85rem", margin: "0 0 0.4rem" }}>시험별 현황</h3>
      <table style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={th}>문제집</th>
            <th style={th}>문항</th>
            <th style={th}>개념</th>
            <th style={th}>학습자</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ e, q, c, learners: n }) => (
            <tr key={e.id}>
              <td style={td}>
                <a href={`/admin/collections/exams/${e.id}`}>
                  {e.icon ? `${e.icon} ` : ""}
                  {e.code}
                </a>
              </td>
              <td style={td}>{q}</td>
              <td style={td}>{c}</td>
              <td style={td}>{n}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 게시 대기 초안 목록 — 작업함 성격(대시보드 v3). 없으면 렌더하지 않는다. */
async function DraftList({ payloadInstance }: { payloadInstance: ServerProps["payload"] }) {
  const collections = ["exams", "questions", "concepts"] as const;
  const label: Record<(typeof collections)[number], string> = {
    exams: "문제집",
    questions: "문항",
    concepts: "개념",
  };
  const drafts = (
    await Promise.all(
      collections.map(async (c) => {
        const r = await payloadInstance.find({
          collection: c,
          where: { _status: { not_equals: "published" } },
          sort: "-updatedAt",
          limit: 10,
          depth: 0,
          draft: true,
          overrideAccess: true,
        });
        return r.docs.map((d) => ({ collection: c, doc: d as { id: number; updatedAt: string } }));
      }),
    )
  )
    .flat()
    .sort((a, b) => String(b.doc.updatedAt).localeCompare(String(a.doc.updatedAt)))
    .slice(0, 10);
  if (!drafts.length) return null;
  return (
    <div style={{ marginTop: "1.2rem" }}>
      <h3 style={{ fontSize: "0.85rem", margin: "0 0 0.4rem" }}>게시 대기 초안</h3>
      <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.85rem", lineHeight: 1.8 }}>
        {drafts.map(({ collection, doc }) => (
          <li key={`${collection}-${doc.id}`}>
            <a href={`/admin/collections/${collection}/${doc.id}`}>
              {label[collection]} #{doc.id}
            </a>{" "}
            <span style={{ fontSize: "0.75rem", color: "var(--theme-elevation-600)" }}>
              {String(doc.updatedAt).slice(0, 16).replace("T", " ")}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const card: React.CSSProperties = {
  border: "1px solid var(--theme-elevation-150)",
  borderRadius: "4px",
  padding: "0.9rem 1.1rem",
  minWidth: "9rem",
};
const num: React.CSSProperties = { fontSize: "1.6rem", fontWeight: 700, lineHeight: 1.2 };
const label: React.CSSProperties = { fontSize: "0.75rem", color: "var(--theme-elevation-600)" };

export default async function DashboardStats({ payload }: ServerProps) {
  const [exams, questions, concepts, qDrafts, cDrafts, recent, learners, active] =
    await Promise.all([
      payload.count({ collection: "exams", overrideAccess: true }),
      payload.count({ collection: "questions", overrideAccess: true }),
      payload.count({ collection: "concepts", overrideAccess: true }),
      payload.count({
        collection: "questions",
        where: { _status: { not_equals: "published" } },
        overrideAccess: true,
      }),
      payload.count({
        collection: "concepts",
        where: { _status: { not_equals: "published" } },
        overrideAccess: true,
      }),
      // 최근 수정 문항 5 — draft 포함(작업 중인 것이 먼저 보여야 하는 표면), 문제집 코드 표시용 depth 1
      payload.find({
        collection: "questions",
        sort: "-updatedAt",
        limit: 5,
        depth: 1,
        draft: true,
        overrideAccess: true,
      }),
      pool.query<{ n: string }>(`select count(*) n from "user"`),
      pool.query<{ n: string }>(
        `select count(distinct "learner_id") n from "progress" where "updated_at" > now() - interval '7 days'`,
      ),
    ]);

  const draftTotal = qDrafts.totalDocs + cDrafts.totalDocs;
  const stats = [
    { label: "문제집", value: exams.totalDocs },
    { label: "문항", value: questions.totalDocs },
    { label: "개념 카드", value: concepts.totalDocs },
    { label: "미게시 초안", value: draftTotal },
    { label: "학습자(전체)", value: learners.rows[0]?.n ?? "0" },
    { label: "활동 학습자(7일)", value: active.rows[0]?.n ?? "0" },
  ];

  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <h2 style={{ fontSize: "1rem", margin: "0 0 0.6rem" }}>QuizDeck 현황</h2>
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        {stats.map((s) => (
          <div key={s.label} style={card}>
            <div style={{ ...num, ...(s.label === "미게시 초안" && Number(s.value) > 0 ? { color: "var(--theme-warning-500, #b45309)" } : {}) }}>
              {s.value}
            </div>
            <div style={label}>{s.label}</div>
          </div>
        ))}
      </div>

      {recent.docs.length > 0 && (
        <div style={{ marginTop: "1rem" }}>
          <h3 style={{ fontSize: "0.85rem", margin: "0 0 0.4rem" }}>최근 수정 문항</h3>
          <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.85rem", lineHeight: 1.8 }}>
            {recent.docs.map((d) => {
              const exam = d.exam as { code?: string } | number;
              const code = typeof exam === "object" ? (exam.code ?? "?") : "?";
              return (
                <li key={d.id}>
                  <a href={`/admin/collections/questions/${d.id}`}>
                    {code} · Q{d.qn}
                  </a>{" "}
                  <span style={label}>
                    {d._status !== "published" ? "· 초안 " : ""}·{" "}
                    {String(d.updatedAt).slice(0, 16).replace("T", " ")}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <ActivityChart />

      <ExamSummary payloadInstance={payload} />

      <DraftList payloadInstance={payload} />

      <p style={{ ...label, marginTop: "0.8rem" }}>
        배포: <code>{process.env.BUILD_SHA ?? "dev"}</code>
        {" · "}
        <a href="/admin/globals/site-config">사이트 설정</a>
        {" · "}
        <a href="https://myquizdeck.com" target="_blank" rel="noreferrer">
          사이트 열기 ↗
        </a>
        {" · "}
        <a href="https://dash.better-auth.com" target="_blank" rel="noreferrer">
          인증 대시보드 ↗
        </a>
      </p>
    </div>
  );
}
