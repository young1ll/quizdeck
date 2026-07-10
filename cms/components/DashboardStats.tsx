import React from "react";
import type { ServerProps } from "payload";
import { pool } from "../../lib/db.ts";

// 운영 대시보드 위젯 (ADR-0024 확장 A) — /admin 첫 화면(beforeDashboard). WordPress 대시보드의
// 등가: 콘텐츠 규모·학습자 활동·배포 정보를 한눈에. 서버 컴포넌트 — Payload Local API(props.payload)
// + 공유 pg 풀(학습자 지표는 public 스키마 소유)로 읽는다. 조회 5개 수준 — admin 첫 화면 한정이라 저렴.

const card: React.CSSProperties = {
  border: "1px solid var(--theme-elevation-150)",
  borderRadius: "4px",
  padding: "0.9rem 1.1rem",
  minWidth: "9rem",
};
const num: React.CSSProperties = { fontSize: "1.6rem", fontWeight: 700, lineHeight: 1.2 };
const label: React.CSSProperties = { fontSize: "0.75rem", color: "var(--theme-elevation-600)" };

export default async function DashboardStats({ payload }: ServerProps) {
  const [exams, questions, concepts, learners, active] = await Promise.all([
    payload.count({ collection: "exams", overrideAccess: true }),
    payload.count({ collection: "questions", overrideAccess: true }),
    payload.count({ collection: "concepts", overrideAccess: true }),
    pool.query<{ n: string }>(`select count(*) n from "user"`),
    pool.query<{ n: string }>(
      `select count(distinct "learner_id") n from "progress" where "updated_at" > now() - interval '7 days'`,
    ),
  ]);

  const stats = [
    { label: "문제집", value: exams.totalDocs },
    { label: "문항", value: questions.totalDocs },
    { label: "개념 카드", value: concepts.totalDocs },
    { label: "학습자(전체)", value: learners.rows[0]?.n ?? "0" },
    { label: "활동 학습자(7일)", value: active.rows[0]?.n ?? "0" },
  ];

  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <h2 style={{ fontSize: "1rem", margin: "0 0 0.6rem" }}>QuizDeck 현황</h2>
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        {stats.map((s) => (
          <div key={s.label} style={card}>
            <div style={num}>{s.value}</div>
            <div style={label}>{s.label}</div>
          </div>
        ))}
      </div>
      <p style={{ ...label, marginTop: "0.8rem" }}>
        배포: <code>{process.env.BUILD_SHA ?? "dev"}</code>
        {" · "}
        <a href="https://myquizdeck.com" target="_blank" rel="noreferrer">
          사이트 열기 ↗
        </a>
        {" · "}
        <a href="https://dash.better-auth.com" target="_blank" rel="noreferrer">
          인증 대시보드(사용자 밴·롤) ↗
        </a>
      </p>
    </div>
  );
}
