"use client";

import { useState } from "react";
import type { Question } from "./types";
import type { LocalizedQuestion } from "./content-localize";
import { parseContentCommand, type ContentCommand } from "./content-command";
import { sendContentCommand } from "./content-command-client";
import {
  nextQn,
  mergeQuestion,
  removeQuestion,
  setOptionValue,
  addOption,
  removeOption,
  toggleAnswer,
} from "./content-draft";

// 문항 편집 오케스트레이션 헤드리스 훅 (아키텍처 리뷰 C2). state(items·draft·busy·err) + 효과(프리플라이트
// →전송→낙관적 병합)만 담고, 결정은 content-draft(순수)에 위임한다. send 를 주입받아(기본 sendContentCommand)
// renderHook + fake send 로 테스트된다. remove 는 confirm-free — 브라우저 다이얼로그는 패널이 소유한다.

interface Deps {
  send?: (cmd: ContentCommand) => Promise<Response>;
}

export function useQuestionDraft(
  examKey: string,
  editLang: string,
  initial: LocalizedQuestion[],
  { send = sendContentCommand }: Deps = {},
) {
  const [items, setItems] = useState<LocalizedQuestion[]>(initial);
  const [draft, setDraft] = useState<Question | null>(null);
  const [isNew, setIsNew] = useState(false); // qn 은 PK — 기존 편집 시 잠가 orphan 방지
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const openNew = () => {
    setIsNew(true);
    setDraft({ qn: nextQn(items), topic: "", q: "", options: { A: "" }, answer: [] });
  };
  const openEdit = (q: Question) => {
    setIsNew(false);
    setDraft(q);
  };
  const cancel = () => {
    setDraft(null);
    setErr(null);
  };
  const patch = (fn: (d: Question) => Question) => setDraft((d) => (d ? fn(d) : d));

  const save = async () => {
    if (!draft) return;
    setErr(null);
    // 전송 전 서버와 **같은** parseContentCommand 로 셀프 프리플라이트(서버 검증은 그대로 authority).
    const cmd = {
      kind: "upsert-question",
      examKey,
      lang: editLang,
      question: draft,
    } satisfies ContentCommand;
    const check = parseContentCommand(cmd);
    if ("error" in check) {
      setErr(check.error);
      return;
    }
    setBusy(true);
    const res = await send(cmd);
    setBusy(false);
    if (!res.ok) {
      setErr(`저장 실패 (${res.status}) ${await res.text()}`);
      return;
    }
    setItems((prev) => mergeQuestion(prev, draft, editLang));
    setDraft(null);
  };

  const remove = async (qn: number) => {
    setBusy(true);
    const res = await send({ kind: "delete-question", examKey, qn });
    setBusy(false);
    if (res.ok) setItems((prev) => removeQuestion(prev, qn));
  };

  // 필드 편집 — 순수 content-draft 변환을 draft 에 적용(패널은 프레젠테이션만).
  const setField = (p: Partial<Question>) => patch((d) => ({ ...d, ...p }));
  const setOption = (k: string, v: string) => patch((d) => setOptionValue(d, k, v));
  const addOpt = () => patch(addOption);
  const removeOpt = (k: string) => patch((d) => removeOption(d, k));
  const toggleAns = (k: string) => patch((d) => toggleAnswer(d, k));

  return {
    items,
    draft,
    isNew,
    busy,
    err,
    openNew,
    openEdit,
    cancel,
    save,
    remove,
    setField,
    setOption,
    addOpt,
    removeOpt,
    toggleAns,
  };
}
