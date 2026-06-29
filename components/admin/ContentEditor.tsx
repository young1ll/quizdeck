"use client";

import { useState } from "react";
import type { Concept, Question } from "@/lib/types";
import {
  conceptForLang,
  questionForLang,
  LANG_LABEL,
  type LocalizedConcept,
  type LocalizedQuestion,
} from "@/lib/content-localize";

// 어드민 콘텐츠 편집기 (이슈 #27·#28 / ADR-0005 B·C). 언어별 편집 — editLang 슬롯만 보고/저장하고,
// 다른 언어 슬롯은 서버 upsert 가 보존한다(content || excluded). /api/admin/content 로 CRUD,
// 서버가 revalidatePath 로 Exam 페이지를 즉시 갱신한다. svc/qn 이 식별자.

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const SUPPORTED_LANGS = ["ko", "en"]; // 편집 가능 언어(슬롯이 없으면 새로 채운다)

function putContent(body: unknown) {
  return fetch(`${BASE_PATH}/api/admin/content`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
}
function delContent(body: unknown) {
  return fetch(`${BASE_PATH}/api/admin/content`, {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
}

export default function ContentEditor({
  examKey,
  defaultLang,
  questions,
  concepts,
}: {
  examKey: string;
  defaultLang: string;
  questions: LocalizedQuestion[];
  concepts: LocalizedConcept[];
}) {
  const [tab, setTab] = useState<"q" | "c">("q");
  const [editLang, setEditLang] = useState(
    SUPPORTED_LANGS.includes(defaultLang) ? defaultLang : SUPPORTED_LANGS[0],
  );

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-xl font-bold">
        어드민 · <span className="font-mono text-[var(--accent)]">{examKey}</span>
      </h1>
      <div className="mt-2 flex items-center gap-2 text-xs">
        <span className="text-[var(--muted)]">편집 언어</span>
        {SUPPORTED_LANGS.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setEditLang(l)}
            aria-pressed={l === editLang}
            className={
              "rounded-lg px-2.5 py-1 font-medium transition-colors " +
              (l === editLang
                ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                : "text-[var(--muted)] hover:text-[var(--fg)]")
            }
          >
            {LANG_LABEL[l] ?? l}
          </button>
        ))}
        <span className="ml-1 text-[var(--muted)]">· 저장 시 시험 페이지에 즉시 반영</span>
      </div>

      <div className="mt-4 mb-4 flex gap-1 text-sm">
        <TabBtn active={tab === "q"} onClick={() => setTab("q")}>문항 {questions.length}</TabBtn>
        <TabBtn active={tab === "c"} onClick={() => setTab("c")}>개념 {concepts.length}</TabBtn>
      </div>

      {tab === "q" ? (
        <QuestionsPanel examKey={examKey} editLang={editLang} initial={questions} />
      ) : (
        <ConceptsPanel examKey={examKey} editLang={editLang} initial={concepts} />
      )}
    </main>
  );
}

function QuestionsPanel({
  examKey,
  editLang,
  initial,
}: {
  examKey: string;
  editLang: string;
  initial: LocalizedQuestion[];
}) {
  const [items, setItems] = useState<LocalizedQuestion[]>(initial);
  const [draft, setDraft] = useState<Question | null>(null);
  const [isNew, setIsNew] = useState(false); // qn 은 PK — 기존 편집 시 잠가 orphan 방지
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const nextQn = () => items.reduce((m, q) => Math.max(m, q.qn), 0) + 1;

  const save = async () => {
    if (!draft) return;
    setErr(null);
    setBusy(true);
    const res = await putContent({ type: "question", examKey, lang: editLang, question: draft });
    setBusy(false);
    if (!res.ok) {
      setErr(`저장 실패 (${res.status}) ${await res.text()}`);
      return;
    }
    const { qn, answer, ...text } = draft;
    setItems((prev) => {
      const existing = prev.find((i) => i.qn === qn);
      const merged: LocalizedQuestion = {
        qn,
        answer,
        content: { ...(existing?.content ?? {}), [editLang]: text },
      };
      return [...prev.filter((i) => i.qn !== qn), merged].sort((a, b) => a.qn - b.qn);
    });
    setDraft(null);
  };
  const remove = async (qn: number) => {
    if (!confirm(`문항 ${qn} 을 삭제할까요? (모든 언어)`)) return;
    setBusy(true);
    const res = await delContent({ type: "question", examKey, qn });
    setBusy(false);
    if (res.ok) setItems((prev) => prev.filter((i) => i.qn !== qn));
  };

  const setField = (patch: Partial<Question>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const setOpt = (k: string, v: string) => setDraft((d) => (d ? { ...d, options: { ...d.options, [k]: v } } : d));
  const addOpt = () =>
    setDraft((d) => {
      if (!d) return d;
      const next = String.fromCharCode(65 + Object.keys(d.options).length);
      return { ...d, options: { ...d.options, [next]: "" } };
    });
  const removeOpt = (k: string) =>
    setDraft((d) => {
      if (!d) return d;
      const { [k]: _drop, ...rest } = d.options;
      return { ...d, options: rest, answer: d.answer.filter((a) => a !== k) };
    });
  const toggleAns = (k: string) =>
    setDraft((d) =>
      d ? { ...d, answer: d.answer.includes(k) ? d.answer.filter((a) => a !== k) : [...d.answer, k] } : d,
    );

  if (draft) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <label className="text-xs text-[var(--muted)]">qn</label>
          <input
            type="number"
            value={draft.qn}
            disabled={!isNew}
            title={isNew ? undefined : "기존 문항 번호는 식별자라 변경 불가"}
            onChange={(e) => setField({ qn: Number(e.target.value) })}
            className="w-20 rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-sm disabled:opacity-60"
          />
          <Input label="주제(topic)" value={draft.topic} onChange={(v) => setField({ topic: v })} />
        </div>
        <Area label="문제(q, 마크다운)" value={draft.q} onChange={(v) => setField({ q: v })} rows={4} />

        <div className="rounded-lg border border-[var(--border)] p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs text-[var(--muted)]">보기 · 정답 체크 (정답은 언어 무관)</span>
            <button type="button" onClick={addOpt} className="text-xs text-[var(--accent)]">+ 보기</button>
          </div>
          <div className="space-y-1">
            {Object.entries(draft.options).map(([k, v]) => (
              <div key={k} className="flex items-center gap-2">
                <input type="checkbox" checked={draft.answer.includes(k)} onChange={() => toggleAns(k)} title="정답" />
                <span className="w-5 font-mono text-xs">{k}</span>
                <input
                  value={v}
                  onChange={(e) => setOpt(k, e.target.value)}
                  className="flex-1 rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-sm"
                />
                <button type="button" onClick={() => removeOpt(k)} className="text-xs text-[var(--bad)]">✕</button>
              </div>
            ))}
          </div>
        </div>

        <Area label="해설(explanation)" value={draft.explanation ?? ""} onChange={(v) => setField({ explanation: v || undefined })} rows={3} />
        <Input label="팁(tip)" value={draft.tip ?? ""} onChange={(v) => setField({ tip: v || undefined })} />

        {err && <p className="text-xs text-[var(--bad)]" role="alert">{err}</p>}
        <div className="flex gap-2">
          <button type="button" disabled={busy} onClick={save} className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-fg)] disabled:opacity-50">
            {busy ? "저장 중…" : `저장 (${editLang})`}
          </button>
          <button type="button" onClick={() => { setDraft(null); setErr(null); }} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm">취소</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          setIsNew(true);
          setDraft({ qn: nextQn(), topic: "", q: "", options: { A: "" }, answer: [] });
        }}
        className="mb-3 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm hover:border-[var(--accent)]"
      >
        + 새 문항
      </button>
      <ul className="space-y-1">
        {items.map((i) => {
          const translated = Boolean(i.content[editLang]);
          const q = questionForLang(i, editLang);
          return (
            <li key={i.qn} className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--panel)] p-2 text-sm">
              <span className="w-10 shrink-0 font-mono text-xs text-[var(--muted)]">#{i.qn}</span>
              <span className="flex-1 truncate">
                {translated ? q.q : <span className="text-[var(--warn)]">(미번역)</span>}
              </span>
              <button type="button" onClick={() => { setIsNew(false); setDraft(questionForLang(i, editLang)); }} className="text-xs text-[var(--accent)]">편집</button>
              <button type="button" onClick={() => remove(i.qn)} className="text-xs text-[var(--bad)]">삭제</button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ConceptsPanel({
  examKey,
  editLang,
  initial,
}: {
  examKey: string;
  editLang: string;
  initial: LocalizedConcept[];
}) {
  const [items, setItems] = useState<LocalizedConcept[]>(initial);
  const [draft, setDraft] = useState<Concept | null>(null);
  const [isNew, setIsNew] = useState(false); // svc 는 PK
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const setField = (patch: Partial<Concept>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  const save = async () => {
    if (!draft) return;
    setErr(null);
    setBusy(true);
    const idx = items.findIndex((c) => c.svc === draft.svc);
    const ord = idx >= 0 ? idx : items.length; // 기존은 위치 보존(서버가 ord 보존), 신규는 끝에
    const res = await putContent({ type: "concept", examKey, lang: editLang, ord, concept: draft });
    setBusy(false);
    if (!res.ok) {
      setErr(`저장 실패 (${res.status}) ${await res.text()}`);
      return;
    }
    const { svc, ...text } = draft;
    setItems((prev) => {
      const existing = prev.find((c) => c.svc === svc);
      const merged: LocalizedConcept = { svc, content: { ...(existing?.content ?? {}), [editLang]: text } };
      const o = prev.filter((c) => c.svc !== svc);
      o.splice(ord, 0, merged);
      return o;
    });
    setDraft(null);
  };
  const remove = async (svc: string) => {
    if (!confirm(`개념 "${svc}" 을 삭제할까요? (모든 언어)`)) return;
    setBusy(true);
    const res = await delContent({ type: "concept", examKey, svc });
    setBusy(false);
    if (res.ok) setItems((prev) => prev.filter((c) => c.svc !== svc));
  };

  if (draft) {
    return (
      <div className="space-y-2">
        <Input label="서비스명(svc, 식별자)" value={draft.svc} onChange={(v) => setField({ svc: v })} disabled={!isNew} />
        <Input label="분류(cat)" value={draft.cat} onChange={(v) => setField({ cat: v })} />
        <Input label="약어(abbr)" value={draft.abbr ?? ""} onChange={(v) => setField({ abbr: v || undefined })} />
        <Area label="정의(deff)" value={draft.deff} onChange={(v) => setField({ deff: v })} rows={2} />
        <Area label="핵심(key)" value={draft.key} onChange={(v) => setField({ key: v })} rows={2} />
        <Input label="언제(when)" value={draft.when} onChange={(v) => setField({ when: v })} />
        <Input label="함정(trap)" value={draft.trap} onChange={(v) => setField({ trap: v })} />
        <Input label="비교(vs)" value={draft.vs} onChange={(v) => setField({ vs: v })} />

        {err && <p className="text-xs text-[var(--bad)]" role="alert">{err}</p>}
        <div className="flex gap-2">
          <button type="button" disabled={busy} onClick={save} className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-fg)] disabled:opacity-50">
            {busy ? "저장 중…" : `저장 (${editLang})`}
          </button>
          <button type="button" onClick={() => { setDraft(null); setErr(null); }} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm">취소</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          setIsNew(true);
          setDraft({ svc: "", cat: "", deff: "", key: "", when: "", trap: "", vs: "" });
        }}
        className="mb-3 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm hover:border-[var(--accent)]"
      >
        + 새 개념
      </button>
      <ul className="space-y-1">
        {items.map((i) => {
          const translated = Boolean(i.content[editLang]);
          return (
            <li key={i.svc} className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--panel)] p-2 text-sm">
              <span className="flex-1 truncate font-medium">{i.svc}</span>
              {!translated && <span className="shrink-0 text-xs text-[var(--warn)]">(미번역)</span>}
              <button type="button" onClick={() => { setIsNew(false); setDraft(conceptForLang(i, editLang)); }} className="text-xs text-[var(--accent)]">편집</button>
              <button type="button" onClick={() => remove(i.svc)} className="text-xs text-[var(--bad)]">삭제</button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-lg px-3 py-1 font-medium transition-colors " +
        (active ? "bg-[var(--accent)] text-[var(--accent-fg)]" : "text-[var(--muted)] hover:text-[var(--fg)]")
      }
    >
      {children}
    </button>
  );
}

function Input({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-xs text-[var(--muted)]">{label}</span>
      <input
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-sm outline-none focus:border-[var(--accent)] disabled:opacity-60"
      />
    </label>
  );
}

function Area({ label, value, onChange, rows }: { label: string; value: string; onChange: (v: string) => void; rows: number }) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-xs text-[var(--muted)]">{label}</span>
      <textarea
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-sm outline-none focus:border-[var(--accent)]"
      />
    </label>
  );
}
