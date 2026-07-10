"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LuPlus } from "react-icons/lu";
import { Button } from "@/components/ui/Button";
import { COLLECTION_NAME_MAX } from "@/lib/collection";

// 컬렉션 생성 (ADR-0022 S1.5). 목록 페이지(RSC)의 클라이언트 잎 — PUT 후 router.refresh() 로 RSC 재조회.
export default function CreateCollection() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/collections", {
      method: "PUT",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        collection: { id: crypto.randomUUID(), name: trimmed, items: [], updatedAt: Date.now() },
      }),
    });
    if (res.ok) {
      setName("");
      router.refresh();
    } else setErr("생성에 실패했습니다.");
    setBusy(false);
  };

  return (
    <div>
      <div className="flex items-center gap-2">
        <input
          value={name}
          maxLength={COLLECTION_NAME_MAX}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void create()}
          placeholder="새 컬렉션 이름 (예: 약점 모음)"
          className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm"
        />
        <Button
          variant="primary"
          size="sm"
          icon={<LuPlus className="size-3.5" />}
          onClick={() => void create()}
          disabled={busy || !name.trim()}
        >
          만들기
        </Button>
      </div>
      {err && <p className="mt-1 text-xs text-red-500">{err}</p>}
    </div>
  );
}
