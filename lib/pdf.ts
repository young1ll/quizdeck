import { renderMarkdown } from "./md";
import { topicStat, type QuizResult } from "./session";
import type { Question, ExamMeta } from "./types";
import type { Store } from "./store";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const md = renderMarkdown;

function detailHTML(d: Question, sel: string[] | undefined, memo?: string): string {
  const keys = Object.keys(d.options).sort();
  const o = keys
    .map((k) => {
      const a = d.answer.includes(k);
      const s = !!sel && sel.includes(k);
      return `<div>${a ? "✅" : s ? "❌" : "&nbsp;&nbsp;"} <b>${k}.</b> ${md(
        d.options[k],
      )}${s ? " <i>(내 선택)</i>" : ""}</div>`;
    })
    .join("");
  return `<div style="border:1px solid #ccc;border-radius:8px;padding:10px;margin:8px 0;break-inside:avoid">
    <div style="font-size:12px;color:#666">Q${d.qn} · ${esc(d.topic)} · 정답 ${d.answer.join(
      ", ",
    )}${d.page != null ? " · 원문 p" + d.page : ""}</div>
    <div style="margin:4px 0;white-space:pre-wrap"><b>${md(d.q)}</b></div>${o}
    <div style="background:#f5f5f5;border-radius:6px;padding:8px;margin-top:6px"><b>해설</b><br>${md(
      d.explanation ?? "",
    )}</div>
    ${
      d.tip
        ? `<div style="background:#eef6e8;border-radius:6px;padding:8px;margin-top:5px"><b>💡 팁</b><br>${md(
            d.tip,
          )}</div>`
        : ""
    }
    ${
      memo
        ? `<div style="background:#fff8e1;border-radius:6px;padding:8px;margin-top:5px;white-space:pre-wrap"><b>📝 메모</b><br>${esc(
            memo,
          )}</div>`
        : ""
    }</div>`;
}

function printHTML(inner: string): void {
  let area = document.getElementById("printarea");
  if (!area) {
    area = document.createElement("div");
    area.id = "printarea";
    document.body.appendChild(area);
  }
  area.innerHTML = inner;
  window.print();
}

// 결과 PDF — 컨트롤러가 낸 결과 모델(QuizResult, 순수)을 그대로 렌더한다. 재채점하지 않는다
// (채점·집계는 lib/session computeResult 단일 정의). wrong 은 {qn, 내 선택}이라 세션 참조 불필요.
export function exportResultPDF(
  result: QuizResult,
  byQn: Map<number, Question>,
  meta: ExamMeta,
): void {
  const { okCount, total, pct, wrong } = result;
  let h = `<h2>${esc(meta.code)} 세션 결과</h2><p>${new Date().toLocaleString(
    "ko",
  )} · ${okCount}/${total} (${pct}%)</p><h3>틀린 문항 (${wrong.length})</h3>`;
  wrong.forEach(({ qn, sel }) => {
    const d = byQn.get(qn);
    if (d) h += detailHTML(d, sel, undefined);
  });
  printHTML(h);
}

export function exportProgressPDF(
  questions: Question[],
  store: Store,
  meta: ExamMeta,
  masteryPct: number,
  streakDays: number,
): void {
  const t = topicStat(questions, store.hist);
  const byQn = new Map(questions.map((q) => [q.qn, q]));
  let h = `<h2>${esc(meta.code)} 학습 리포트</h2><p>생성: ${new Date().toLocaleString(
    "ko",
  )} · 숙련도 ${masteryPct}% · 연속 ${streakDays}일</p>
    <h3>주제별 정답률</h3><table border="1" cellpadding="6" style="border-collapse:collapse;width:100%"><tr><th align="left">주제</th><th>시도</th><th>정답률</th></tr>`;
  for (const [topic, m] of Object.entries(t)) {
    const p = m.seen ? Math.round((m.ok / m.seen) * 100) + "%" : "–";
    h += `<tr><td>${esc(topic)}</td><td align="center">${m.seen}/${m.n}</td><td align="center">${p}</td></tr>`;
  }
  h += `</table><h3 style="margin-top:16px">오답 문항 (${store.wrong.length})</h3>`;
  store.wrong
    .slice()
    .sort((a, b) => a - b)
    .forEach((qn) => {
      const d = byQn.get(qn);
      if (d) h += detailHTML(d, store.hist[qn]?.lastSel, store.memos[qn]);
    });
  printHTML(h);
}
