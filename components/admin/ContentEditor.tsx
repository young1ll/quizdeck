"use client";

import { useState } from "react";
import { LuX } from "react-icons/lu";
import { TextInput } from "@astryxdesign/core/TextInput";
import { TextArea } from "@astryxdesign/core/TextArea";
import { NumberInput } from "@astryxdesign/core/NumberInput";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import {
  conceptForLang,
  questionForLang,
  LANG_LABEL,
  type LocalizedConcept,
  type LocalizedQuestion,
} from "@/lib/content-localize";
import { useQuestionDraft } from "@/lib/use-question-draft";
import { useConceptDraft } from "@/lib/use-concept-draft";
import { Button } from "@/components/ui/Button";
import { Msg } from "@/components/ui/Msg";

// 어드민 콘텐츠 편집기 (이슈 #27·#28 / ADR-0005 B·C · 아키텍처 리뷰 C2). 언어별 편집 — editLang 슬롯만
// 보고/저장하고, 다른 언어 슬롯은 서버 upsert 가 보존한다(content || excluded). 편집 상태·오케스트레이션은
// use-question-draft·use-concept-draft 헤드리스 훅이 소유하고, 이 컴포넌트는 렌더-only 다(결정은 훅 뒤
// 순수 content-draft). 삭제 confirm 다이얼로그만 패널이 소유한다(훅은 confirm-free — 테스트 가능).

const SUPPORTED_LANGS = ["ko", "en"]; // 편집 가능 언어(슬롯이 없으면 새로 채운다)

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
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-[var(--muted)]">편집 언어</span>
        <SegmentedControl value={editLang} onChange={setEditLang} label="편집 언어" size="sm">
          {SUPPORTED_LANGS.map((l) => (
            <SegmentedControlItem key={l} value={l} label={LANG_LABEL[l] ?? l} />
          ))}
        </SegmentedControl>
        <span className="text-[var(--muted)]">· 저장 시 시험 페이지에 즉시 반영</span>
      </div>

      <div className="mt-4 mb-4">
        <SegmentedControl value={tab} onChange={(v) => setTab(v as "q" | "c")} label="편집 대상" size="sm">
          <SegmentedControlItem value="q" label={`문항 ${questions.length}`} />
          <SegmentedControlItem value="c" label={`개념 ${concepts.length}`} />
        </SegmentedControl>
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
  const q = useQuestionDraft(examKey, editLang, initial);
  const confirmRemove = (qn: number) => {
    if (confirm(`문항 ${qn} 을 삭제할까요? (모든 언어)`)) void q.remove(qn);
  };

  if (q.draft) {
    const draft = q.draft;
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-24 shrink-0">
            <NumberInput
              label="qn"
              value={draft.qn}
              isDisabled={!q.isNew}
              isIntegerOnly
              labelTooltip={q.isNew ? undefined : "기존 문항 번호는 식별자라 변경 불가"}
              onChange={(v) => q.setField({ qn: v ?? draft.qn })}
            />
          </div>
          <div className="flex-1">
            <Input label="주제(topic)" value={draft.topic} onChange={(v) => q.setField({ topic: v })} />
          </div>
        </div>
        <Area label="문제(q, 마크다운)" value={draft.q} onChange={(v) => q.setField({ q: v })} rows={4} />

        <div className="rounded-lg border border-[var(--border)] p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs text-[var(--muted)]">보기 · 정답 체크 (정답은 언어 무관)</span>
            <button type="button" onClick={q.addOpt} className="text-xs text-[var(--accent)]">+ 보기</button>
          </div>
          <div className="space-y-1">
            {Object.entries(draft.options).map(([k, v]) => (
              <div key={k} className="flex items-center gap-2">
                <input type="checkbox" checked={draft.answer.includes(k)} onChange={() => q.toggleAns(k)} title="정답" />
                <span className="w-5 font-mono text-xs">{k}</span>
                <input
                  value={v}
                  onChange={(e) => q.setOption(k, e.target.value)}
                  className="flex-1 rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-sm"
                />
                <button
                  type="button"
                  onClick={() => q.removeOpt(k)}
                  aria-label="옵션 삭제"
                  className="text-[var(--bad)]"
                >
                  <LuX className="size-3.5" aria-hidden />
                </button>
              </div>
            ))}
          </div>
        </div>

        <Area label="해설(explanation)" value={draft.explanation ?? ""} onChange={(v) => q.setField({ explanation: v || undefined })} rows={3} />
        <Input label="팁(tip)" value={draft.tip ?? ""} onChange={(v) => q.setField({ tip: v || undefined })} />

        {q.err && <Msg kind="bad">{q.err}</Msg>}
        <div className="flex gap-2">
          <Button variant="primary" loading={q.busy} onClick={q.save}>
            저장 ({editLang})
          </Button>
          <Button variant="outline" onClick={q.cancel}>
            취소
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* astryx Button 은 StyleX 로 margin:0 고정 → mb-* 무력. 간격은 plain wrapper 에 준다. */}
      <div className="mb-3">
        <Button variant="outline" size="sm" onClick={q.openNew}>
          + 새 문항
        </Button>
      </div>
      <ul className="space-y-1">
        {q.items.map((i) => {
          const translated = Boolean(i.content[editLang]);
          const view = questionForLang(i, editLang);
          return (
            <li key={i.qn} className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--panel)] p-2 text-sm">
              <span className="w-10 shrink-0 font-mono text-xs text-[var(--muted)]">#{i.qn}</span>
              <span className="flex-1 truncate">
                {translated ? view.q : <span className="text-[var(--warn)]">(미번역)</span>}
              </span>
              <button type="button" onClick={() => q.openEdit(questionForLang(i, editLang))} className="text-xs text-[var(--accent)]">편집</button>
              <button type="button" onClick={() => confirmRemove(i.qn)} className="text-xs text-[var(--bad)]">삭제</button>
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
  const c = useConceptDraft(examKey, editLang, initial);
  const confirmRemove = (svc: string) => {
    if (confirm(`개념 "${svc}" 을 삭제할까요? (모든 언어)`)) void c.remove(svc);
  };

  if (c.draft) {
    const draft = c.draft;
    return (
      <div className="space-y-2">
        <Input label="서비스명(svc, 식별자)" value={draft.svc} onChange={(v) => c.setField({ svc: v })} disabled={!c.isNew} />
        <Input label="분류(cat)" value={draft.cat} onChange={(v) => c.setField({ cat: v })} />
        <Input label="약어(abbr)" value={draft.abbr ?? ""} onChange={(v) => c.setField({ abbr: v || undefined })} />
        <Area label="정의(deff)" value={draft.deff} onChange={(v) => c.setField({ deff: v })} rows={2} />
        <Area label="핵심(key)" value={draft.key} onChange={(v) => c.setField({ key: v })} rows={2} />
        <Input label="언제(when)" value={draft.when} onChange={(v) => c.setField({ when: v })} />
        <Input label="함정(trap)" value={draft.trap} onChange={(v) => c.setField({ trap: v })} />
        <Input label="비교(vs)" value={draft.vs} onChange={(v) => c.setField({ vs: v })} />

        {c.err && <Msg kind="bad">{c.err}</Msg>}
        <div className="flex gap-2">
          <Button variant="primary" loading={c.busy} onClick={c.save}>
            저장 ({editLang})
          </Button>
          <Button variant="outline" onClick={c.cancel}>
            취소
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* astryx Button 은 StyleX 로 margin:0 고정 → mb-* 무력. 간격은 plain wrapper 에 준다. */}
      <div className="mb-3">
        <Button variant="outline" size="sm" onClick={c.openNew}>
          + 새 개념
        </Button>
      </div>
      <ul className="space-y-1">
        {c.items.map((i) => {
          const translated = Boolean(i.content[editLang]);
          return (
            <li key={i.svc} className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--panel)] p-2 text-sm">
              <span className="flex-1 truncate font-medium">{i.svc}</span>
              {!translated && <span className="shrink-0 text-xs text-[var(--warn)]">(미번역)</span>}
              <button type="button" onClick={() => c.openEdit(conceptForLang(i, editLang))} className="text-xs text-[var(--accent)]">편집</button>
              <button type="button" onClick={() => confirmRemove(i.svc)} className="text-xs text-[var(--bad)]">삭제</button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// 어드민 폼 필드 — astryx 래퍼 (ADR-0014 Phase 5). Input→TextInput, Area→TextArea. 호출부 시그니처 유지.
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
  return <TextInput label={label} value={value} onChange={(v) => onChange(v)} isDisabled={disabled} />;
}

function Area({ label, value, onChange, rows }: { label: string; value: string; onChange: (v: string) => void; rows: number }) {
  return <TextArea label={label} value={value} onChange={(v) => onChange(v)} rows={rows} />;
}
