"use client";
import React, { useState } from "react";

// JSON 반입 폼 (2차 확장 C① — 클라이언트). 파일 선택 → /api/cms/import-json POST.
// 정책(합의): 원자적 — 서버가 검증 실패 목록을 주면 아무것도 안 만들어진 것. 성공 시 전부
// 초안 — 문항/개념 목록에서 검토 후 게시.

interface ImportError {
  index: number;
  id: string;
  message: string;
}
interface ExamOption {
  id: number;
  label: string;
}

export default function ImportForm({ exams }: { exams: ExamOption[] }) {
  const [examId, setExamId] = useState(exams[0]?.id);
  const [kind, setKind] = useState<"questions" | "concepts">("questions");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [errors, setErrors] = useState<ImportError[]>([]);
  const [file, setFile] = useState<File | null>(null);

  const submit = async () => {
    if (!file || !examId) return;
    setBusy(true);
    setResult(null);
    setErrors([]);
    try {
      const text = await file.text();
      let items: unknown;
      try {
        items = JSON.parse(text);
      } catch {
        setResult("JSON 파싱 실패 — 파일 형식을 확인하세요");
        return;
      }
      const res = await fetch("/api/cms/import-json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examId, kind, items }),
      });
      const j = (await res.json()) as { created?: number; error?: string; errors?: ImportError[] };
      if (res.ok) {
        setResult(`✅ ${j.created}건이 초안으로 반입되었습니다 — 목록에서 검토 후 게시하세요.`);
      } else {
        setResult(`❌ ${j.error ?? res.status}`);
        setErrors(j.errors ?? []);
      }
    } finally {
      setBusy(false);
    }
  };

  const row: React.CSSProperties = { display: "flex", gap: "0.6rem", alignItems: "center", marginBottom: "0.7rem" };
  return (
    <div style={{ maxWidth: "40rem" }}>
      <div style={row}>
        <label style={{ width: "7rem" }}>대상 문제집</label>
        <select value={examId} onChange={(e) => setExamId(Number(e.target.value))} disabled={busy}>
          {exams.map((e) => (
            <option key={e.id} value={e.id}>
              {e.label}
            </option>
          ))}
        </select>
      </div>
      <div style={row}>
        <label style={{ width: "7rem" }}>유형</label>
        <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} disabled={busy}>
          <option value="questions">문항 (questions.json 포맷)</option>
          <option value="concepts">개념 카드 (concepts.json 포맷)</option>
        </select>
      </div>
      <div style={row}>
        <label style={{ width: "7rem" }}>JSON 파일</label>
        <input type="file" accept=".json,application/json" onChange={(e) => setFile(e.target.files?.[0] ?? null)} disabled={busy} />
      </div>
      <button type="button" onClick={submit} disabled={busy || !file || !examId}>
        {busy ? "반입 중…" : "초안으로 반입"}
      </button>
      {result && <p style={{ marginTop: "0.8rem" }}>{result}</p>}
      {errors.length > 0 && (
        <ul style={{ marginTop: "0.4rem", paddingLeft: "1.1rem", fontSize: "0.85rem", color: "var(--theme-error-500, #d33)" }}>
          {errors.slice(0, 30).map((e, i) => (
            <li key={i}>
              [{e.index}] {e.id}: {e.message}
            </li>
          ))}
          {errors.length > 30 && <li>… 외 {errors.length - 30}건</li>}
        </ul>
      )}
    </div>
  );
}
