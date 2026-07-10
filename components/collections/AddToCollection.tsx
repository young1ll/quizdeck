"use client";

import { useCallback, useState } from "react";
import { LuFolderPlus, LuCheck, LuPlus } from "react-icons/lu";
import { Button } from "@/components/ui/Button";
import {
  addItem,
  parseCollection,
  COLLECTION_NAME_MAX,
  type Collection,
  type CollectionItem,
} from "@/lib/collection";

// '컬렉션에 담기' 피커 (ADR-0022 S1.5). 문항 묶음(items)을 기존 컬렉션에 병합하거나 새 컬렉션으로
// 만든다. 목록은 열 때 lazy-fetch(/api/collections — Learner 세션 쿠키), 담기는 PUT(전체 upsert,
// addItem 이 (examKey,qn) 중복을 걸러 멱등). 게이트: API 가 401 이면 로그인 안내만 — 이 버튼이
// 뜨는 화면(내 문제함)은 이미 Learner 전용이라 실사용 경로에선 발생하지 않는다.
export default function AddToCollection({ items }: { items: CollectionItem[] }) {
  const [open, setOpen] = useState(false);
  const [cols, setCols] = useState<Collection[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [doneId, setDoneId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    const res = await fetch("/api/collections", { credentials: "same-origin" });
    if (!res.ok) {
      setErr(res.status === 401 ? "로그인이 필요합니다." : "목록을 불러오지 못했습니다.");
      return;
    }
    const raw = (await res.json()) as unknown[];
    setCols(raw.map(parseCollection).filter((c): c is Collection => !!c));
  }, []);

  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    setDoneId(null);
    if (next && cols === null) void load();
  };

  const put = useCallback(async (c: Collection): Promise<boolean> => {
    const res = await fetch("/api/collections", {
      method: "PUT",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ collection: c }),
    });
    return res.ok;
  }, []);

  // 기존 컬렉션에 병합 — addItem 반복이라 이미 담긴 문항은 그대로(멱등).
  const addTo = useCallback(
    async (c: Collection) => {
      setBusy(true);
      setErr(null);
      const merged = items.reduce((acc, it) => addItem(acc, it), c.items);
      const next: Collection = { ...c, items: merged, updatedAt: Date.now() };
      if (await put(next)) {
        setCols((prev) => prev?.map((x) => (x.id === c.id ? next : x)) ?? null);
        setDoneId(c.id);
      } else setErr("담기에 실패했습니다.");
      setBusy(false);
    },
    [items, put],
  );

  const createNew = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setErr(null);
    const c: Collection = {
      id: crypto.randomUUID(),
      name: trimmed,
      items: items.reduce((acc, it) => addItem(acc, it), [] as CollectionItem[]),
      updatedAt: Date.now(),
    };
    if (await put(c)) {
      setCols((prev) => [c, ...(prev ?? [])]);
      setDoneId(c.id);
      setName("");
    } else setErr("생성에 실패했습니다.");
    setBusy(false);
  }, [name, items, put]);

  if (items.length === 0) return null;

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        icon={<LuFolderPlus className="size-3.5" />}
        onClick={toggleOpen}
        aria-expanded={open}
      >
        컬렉션에 담기
      </Button>

      {open && (
        <div className="absolute right-0 z-10 mt-2 w-64 rounded-lg border border-[var(--border)] bg-[var(--panel)] p-2 shadow-lg">
          <div className="px-2 py-1 text-xs text-[var(--muted)]">문항 {items.length}개를 담기</div>
          {err && <div className="px-2 py-1 text-xs text-red-500">{err}</div>}

          {cols === null && !err ? (
            <div className="px-2 py-2 text-sm text-[var(--muted)]">불러오는 중…</div>
          ) : (
            <ul className="max-h-48 space-y-1 overflow-y-auto">
              {(cols ?? []).map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => addTo(c)}
                    className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-[var(--border)] disabled:opacity-50"
                  >
                    <span className="truncate">
                      {c.icon && <span className="mr-1">{c.icon}</span>}
                      {c.name}
                    </span>
                    {doneId === c.id ? (
                      <LuCheck className="size-4 shrink-0 text-green-500" aria-label="담김" />
                    ) : (
                      <span className="shrink-0 text-xs text-[var(--muted)]">{c.items.length}</span>
                    )}
                  </button>
                </li>
              ))}
              {cols !== null && cols.length === 0 && (
                <li className="px-2 py-1 text-xs text-[var(--muted)]">컬렉션이 없습니다.</li>
              )}
            </ul>
          )}

          <div className="mt-2 flex items-center gap-1 border-t border-[var(--border)] pt-2">
            <input
              value={name}
              maxLength={COLLECTION_NAME_MAX}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void createNew()}
              placeholder="새 컬렉션 이름"
              className="min-w-0 flex-1 rounded border border-[var(--border)] bg-transparent px-2 py-1 text-sm"
            />
            <Button
              variant="outline"
              size="sm"
              icon={<LuPlus className="size-3.5" />}
              onClick={() => void createNew()}
              disabled={busy || !name.trim()}
              aria-label="새 컬렉션 만들어 담기"
            >
              만들기
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
