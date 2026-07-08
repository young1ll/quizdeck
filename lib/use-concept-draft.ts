"use client";

import { useState } from "react";
import type { Concept } from "./types";
import type { LocalizedConcept } from "./content-localize";
import { parseContentCommand, type ContentCommand } from "./content-command";
import { sendContentCommand } from "./content-command-client";
import { ordFor, mergeConcept, removeConcept } from "./content-draft";

// 개념 편집 오케스트레이션 헤드리스 훅 (아키텍처 리뷰 C2). use-question-draft 대칭 — state + 효과만 담고
// 결정은 content-draft(순수)에 위임. 개념은 옵션/정답 상태기계가 없어 setField 만. ord 는 저장 시
// ordFor 로 계산(기존 위치 보존·신규 끝). remove 는 confirm-free(다이얼로그는 패널 소유).

interface Deps {
  send?: (cmd: ContentCommand) => Promise<Response>;
}

export function useConceptDraft(
  examKey: string,
  editLang: string,
  initial: LocalizedConcept[],
  { send = sendContentCommand }: Deps = {},
) {
  const [items, setItems] = useState<LocalizedConcept[]>(initial);
  const [draft, setDraft] = useState<Concept | null>(null);
  const [isNew, setIsNew] = useState(false); // svc 는 PK
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const openNew = () => {
    setIsNew(true);
    setDraft({ svc: "", cat: "", deff: "", key: "", when: "", trap: "", vs: "" });
  };
  const openEdit = (c: Concept) => {
    setIsNew(false);
    setDraft(c);
  };
  const cancel = () => {
    setDraft(null);
    setErr(null);
  };
  const setField = (p: Partial<Concept>) => setDraft((d) => (d ? { ...d, ...p } : d));

  const save = async () => {
    if (!draft) return;
    setErr(null);
    const ord = ordFor(items, draft.svc); // 기존 위치 보존(서버가 ord 보존), 신규는 끝
    const cmd = {
      kind: "upsert-concept",
      examKey,
      lang: editLang,
      ord,
      concept: draft,
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
    setItems((prev) => mergeConcept(prev, draft, editLang, ord));
    setDraft(null);
  };

  const remove = async (svc: string) => {
    setBusy(true);
    const res = await send({ kind: "delete-concept", examKey, svc });
    setBusy(false);
    if (res.ok) setItems((prev) => removeConcept(prev, svc));
  };

  return { items, draft, isNew, busy, err, openNew, openEdit, cancel, setField, save, remove };
}
