"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LuSmile } from "react-icons/lu";
import { Button } from "@/components/ui/Button";
import IconPicker from "@/components/ui/IconPicker";

// 문제집 아이콘 편집 (ADR-0023) — admin 콘텐츠 목록의 클라이언트 잎. PUT = 오버라이드 저장,
// 빈 값 저장 = DELETE(파일 meta.json 기본값 복귀). 저장 후 router.refresh() 로 RSC 재조회.
export default function ExamIconEditor({
  examKey,
  icon,
  overridden,
  children,
}: {
  examKey: string;
  /** 현재 표시 아이콘(오버라이드 병합 후) — 없으면 미설정 */
  icon?: string;
  /** DB 오버라이드 행 존재 여부 — '기본값 복귀' 안내용 */
  overridden: boolean;
  /** 카드 좌측 내용(시험 링크) — 편집 패널이 카드 안에서 인라인 확장되도록 행 전체를 소유한다. */
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(icon ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setErr(null);
    const trimmed = draft.trim();
    const res = await fetch("/api/admin/exam-icon", {
      method: trimmed ? "PUT" : "DELETE",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(trimmed ? { examKey, icon: trimmed } : { examKey }),
    });
    if (res.ok) {
      setOpen(false);
      router.refresh();
    } else setErr("저장에 실패했습니다.");
    setBusy(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        {children}
        <button
          type="button"
          onClick={() => {
            setOpen((v) => !v);
            setDraft(icon ?? "");
          }}
          aria-label={`${examKey} 아이콘 변경`}
          aria-expanded={open}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--panel)] text-xl"
        >
          {icon ?? <LuSmile className="size-4 text-[var(--muted)]" aria-hidden />}
        </button>
      </div>
      {open && (
        <div className="mt-3 space-y-2 border-t border-[var(--border)] pt-3">
          <IconPicker value={draft} onChange={setDraft} />
          <p className="text-xs text-[var(--muted)]">
            {overridden ? "오버라이드 중 — 비우고 저장하면 파일 기본값으로 복귀." : "파일(meta.json) 기본값 표시 중."}
          </p>
          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={() => void save()} disabled={busy}>
              저장
            </Button>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={busy}>
              취소
            </Button>
          </div>
          {err && <p className="text-xs text-red-500">{err}</p>}
        </div>
      )}
    </div>
  );
}
