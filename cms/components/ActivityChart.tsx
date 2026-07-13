import React from "react";
import { pool } from "../../lib/db.ts";

// 30일 학습 활동 추이 (대시보드 v3 — dataviz 절차 준수). 단일 시리즈 바 차트:
// 범례 없음(제목이 시리즈명), 색은 검증된 쌍(light #2a78d6 / dark #3987e5 — validate_palette
// ALL PASS), 막대는 얇게 + 2px 간격 + 상단만 4px 라운드(바닥 고정), 직접 라벨은 최대·오늘만,
// 나머지는 네이티브 <title> 툴팁, 접이식 표 뷰 제공(색 비의존 접근성).

const BAR_COLOR_VAR = "--qd-chart-1";

interface DayRow {
  day: string; // YYYY-MM-DD
  n: number;
}

async function loadActivity(): Promise<DayRow[]> {
  const r = await pool.query<{ day: string; n: string }>(
    `select to_char(d, 'YYYY-MM-DD') as day,
            count(distinct p."learner_id") as n
       from generate_series(current_date - 29, current_date, interval '1 day') d
       left join "progress" p on p."updated_at"::date = d::date
      group by d order by d`,
  );
  return r.rows.map((row) => ({ day: row.day, n: Number(row.n) }));
}

/** 상단만 라운드된 막대 path — 데이터 끝(윗변)만 둥글고 바닥은 기준선에 붙는다(마크 스펙). */
function barPath(x: number, y: number, w: number, h: number, r: number): string {
  if (h <= r) return `M${x},${y + h} v${-h + 0.01} h${w} v${h - 0.01} z`;
  return `M${x},${y + h} v${-(h - r)} q0,${-r} ${r},${-r} h${w - 2 * r} q${r},0 ${r},${r} v${h - r} z`;
}

export default async function ActivityChart() {
  const days = await loadActivity();
  const max = Math.max(1, ...days.map((d) => d.n));
  const W = 600;
  const H = 72;
  const PAD_TOP = 14; // 직접 라벨 공간
  const plotH = H - PAD_TOP - 1;
  const gap = 2;
  const barW = (W - gap * (days.length - 1)) / days.length;
  const maxIdx = days.findIndex((d) => d.n === max);
  const lastIdx = days.length - 1;

  return (
    <div style={{ marginTop: "1rem" }}>
      <style>{`:root{${BAR_COLOR_VAR}:#2a78d6}html[data-theme="dark"]{${BAR_COLOR_VAR}:#3987e5}`}</style>
      <h3 style={{ fontSize: "0.85rem", margin: "0 0 0.4rem" }}>학습 활동 — 최근 30일 일별 활동 학습자</h3>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", maxWidth: "40rem", height: "auto", display: "block" }}
        role="img"
        aria-label="최근 30일 일별 활동 학습자 수 막대 차트"
      >
        {days.map((d, i) => {
          const h = Math.round((d.n / max) * plotH);
          const x = i * (barW + gap);
          const y = PAD_TOP + (plotH - h);
          const showLabel = d.n > 0 && (i === maxIdx || i === lastIdx);
          return (
            <g key={d.day}>
              {h > 0 ? (
                <path d={barPath(x, y, barW, h, Math.min(4, barW / 2, h))} fill={`var(${BAR_COLOR_VAR})`}>
                  <title>{`${d.day} · ${d.n}명`}</title>
                </path>
              ) : (
                // 0 인 날 — 기준선 위 1px 흔적(빈 날임을 표시하되 마크로 읽히지 않게)
                <rect x={x} y={PAD_TOP + plotH - 1} width={barW} height={1} fill="var(--theme-elevation-200)">
                  <title>{`${d.day} · 0명`}</title>
                </rect>
              )}
              {showLabel && (
                <text
                  x={x + barW / 2}
                  y={y - 3}
                  textAnchor="middle"
                  style={{ fontSize: "10px", fill: "var(--theme-elevation-650)" }}
                >
                  {d.n}
                </text>
              )}
            </g>
          );
        })}
        <line x1="0" y1={H - 1} x2={W} y2={H - 1} stroke="var(--theme-elevation-200)" strokeWidth="1" />
      </svg>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          maxWidth: "40rem",
          fontSize: "0.7rem",
          color: "var(--theme-elevation-500)",
        }}
      >
        <span>{days[0]?.day.slice(5)}</span>
        <span>{days[lastIdx]?.day.slice(5)} (오늘)</span>
      </div>
      <details style={{ marginTop: "0.3rem", fontSize: "0.75rem" }}>
        <summary style={{ cursor: "pointer", color: "var(--theme-elevation-500)" }}>표로 보기</summary>
        <table style={{ borderCollapse: "collapse", marginTop: "0.3rem" }}>
          <tbody>
            {days.filter((d) => d.n > 0).map((d) => (
              <tr key={d.day}>
                <td style={{ padding: "0.1rem 0.6rem 0.1rem 0" }}>{d.day}</td>
                <td style={{ padding: "0.1rem 0" }}>{d.n}명</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
