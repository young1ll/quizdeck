"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LuSmile } from "react-icons/lu";
import { Button } from "@/components/ui/Button";
import IconPicker from "@/components/ui/IconPicker";
import ExamIcon from "@/components/ui/ExamIcon";
import { ICON_IMAGE_MAX_BYTES, ICON_IMAGE_MIMES } from "@/lib/icon-image";

// 문제집 아이콘 편집 (ADR-0023 + 이미지 애던덤) — admin 콘텐츠 목록의 클라이언트 잎. 이모지는
// 피커+저장(PUT {icon}), 이미지는 파일 선택 즉시 업로드(PUT {imageBase64, mime} — base64 봉투,
// 서버 parseIconImage 가 최종 검증). 빈 값 저장 = DELETE(파일 meta.json 기본값 복귀).
// 저장 후 router.refresh() 로 RSC 재조회.
export default function ExamIconEditor({
  examKey,
  icon,
  overridden,
  children,
}: {
  examKey: string;
  /** 현재 표시 아이콘(오버라이드 병합 후) — 이모지 또는 서빙 URL, 없으면 미설정 */
  icon?: string;
  /** DB 오버라이드 행 존재 여부 — '기본값 복귀' 안내용 */
  overridden: boolean;
  /** 카드 좌측 내용(시험 링크) — 편집 패널이 카드 안에서 인라인 확장되도록 행 전체를 소유한다. */
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // 이미지 오버라이드 중이면 URL — 이모지 입력칸에 흘리지 않는다.
  const emojiOf = (v?: string) => (v && !v.startsWith("/") ? v : "");

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

  const uploadFile = async (file: File) => {
    setErr(null);
    if (!(ICON_IMAGE_MIMES as readonly string[]).includes(file.type)) {
      setErr("지원하지 않는 형식입니다 (png·svg·jpeg·webp·gif).");
      return;
    }
    if (file.size > ICON_IMAGE_MAX_BYTES) {
      setErr(`파일이 너무 큽니다 (최대 ${Math.floor(ICON_IMAGE_MAX_BYTES / 1024)}KB).`);
      return;
    }
    setBusy(true);
    const buf = new Uint8Array(await file.arrayBuffer());
    let bin = "";
    for (const b of buf) bin += String.fromCharCode(b);
    const res = await fetch("/api/admin/exam-icon", {
      method: "PUT",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ examKey, imageBase64: btoa(bin), mime: file.type }),
    });
    if (res.ok) {
      setOpen(false);
      router.refresh();
    } else setErr("업로드에 실패했습니다.");
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
            setDraft(emojiOf(icon));
          }}
          aria-label={`${examKey} 아이콘 변경`}
          aria-expanded={open}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--panel)] text-xl"
        >
          {icon ? <ExamIcon icon={icon} /> : <LuSmile className="size-4 text-[var(--muted)]" aria-hidden />}
        </button>
      </div>
      {open && (
        <div className="mt-3 space-y-2 border-t border-[var(--border)] pt-3">
          <IconPicker value={draft} onChange={setDraft} />
          {/* 이미지 파일 오버라이드 — 선택 즉시 업로드(이모지 오버라이드를 대체). */}
          <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--muted)]">
            <span className="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2 py-1.5">
              이미지 파일로 설정…
            </span>
            <span>png·svg·jpeg·webp·gif, 최대 {Math.floor(ICON_IMAGE_MAX_BYTES / 1024)}KB</span>
            <input
              type="file"
              accept={ICON_IMAGE_MIMES.join(",")}
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void uploadFile(f);
              }}
            />
          </label>
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
