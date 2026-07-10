"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LuPlay, LuTrash2, LuX, LuLayers } from "react-icons/lu";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { removeItem, type Collection } from "@/lib/collection";

// 컬렉션 상세 (ADR-0022 S1.5). RSC(page)가 로드한 컬렉션 + 시험별 그룹 뷰데이터를 받아 편집(빼기·
// 삭제)과 '이 시험에서 풀기' 진입을 렌더한다. 풀기는 /quiz?set=… 딥엔트리(시험별 — Session 불변식
// 유지, 혼합 큐는 S2). 뮤테이션은 PUT/DELETE 후 router.refresh() 로 RSC 재조회.
export interface CollectionGroupView {
  examKey: string;
  /** 카탈로그 메타(있으면) — 없으면 시험이 제거된 참조(known=false, 풀기 없음·빼기만). */
  known: boolean;
  name: string;
  code: string;
  icon?: string;
  href: string; // /provider/slug
  items: { qn: number; preview: string | null }[];
}

export default function CollectionDetail({
  collection,
  groups,
}: {
  collection: Collection;
  groups: CollectionGroupView[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const put = async (next: Collection): Promise<boolean> => {
    const res = await fetch("/api/collections", {
      method: "PUT",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ collection: next }),
    });
    return res.ok;
  };

  const remove = async (examKey: string, qn: number) => {
    setBusy(true);
    setErr(null);
    const next: Collection = {
      ...collection,
      items: removeItem(collection.items, { examKey, qn }),
      updatedAt: Date.now(),
    };
    if (await put(next)) router.refresh();
    else setErr("빼기에 실패했습니다.");
    setBusy(false);
  };

  const destroy = async () => {
    if (!confirm(`컬렉션 "${collection.name}" 을(를) 삭제할까요?`)) return;
    setBusy(true);
    const res = await fetch(`/api/collections?id=${encodeURIComponent(collection.id)}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    if (res.ok) router.push("/me/collections");
    else {
      setErr("삭제에 실패했습니다.");
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{collection.name}</h1>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            문항 {collection.items.length}개 · 시험 {groups.length}개
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* 혼합 큐 풀기 (ADR-0022 S2) — 여러 시험 문항을 한 세션으로. 시험별 풀기는 각 그룹에. */}
          {collection.items.length > 0 && (
            <Link href={`/me/collections/${collection.id}/quiz`}>
              <Button variant="primary" size="sm" icon={<LuLayers className="size-3.5" />}>
                전체 풀기
              </Button>
            </Link>
          )}
          <Button
            variant="dangerOutline"
            size="sm"
            icon={<LuTrash2 className="size-3.5" />}
            onClick={() => void destroy()}
            disabled={busy}
          >
            삭제
          </Button>
        </div>
      </header>
      {err && <p className="text-xs text-red-500">{err}</p>}

      {groups.length === 0 ? (
        <EmptyState
          isCompact
          title="비어 있는 컬렉션입니다"
          description="내 문제함에서 '컬렉션에 담기'로 문항을 모아 보세요."
        />
      ) : (
        groups.map((g) => (
          <section key={g.examKey}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-[var(--muted)]">
                {g.icon && <span>{g.icon}</span>}
                <span className="font-mono">{g.code}</span>
                <span className="font-normal">· 문항 {g.items.length}개</span>
              </h2>
              {g.known && (
                <Link href={`${g.href}/quiz?set=${g.items.map((i) => i.qn).join(",")}`}>
                  <Button variant="primary" size="sm" icon={<LuPlay className="size-3.5" />}>
                    이 시험에서 풀기
                  </Button>
                </Link>
              )}
            </div>
            <Card padding={0}>
              <ul className="divide-y divide-[var(--border)]">
                {g.items.map((it) => (
                  <li key={it.qn} className="flex items-center gap-2 px-3 py-2">
                    <span className="shrink-0 font-mono text-xs text-[var(--muted)]">#{it.qn}</span>
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {it.preview ?? <span className="text-[var(--muted)]">문항을 찾을 수 없음(삭제됨)</span>}
                    </span>
                    <button
                      type="button"
                      onClick={() => void remove(g.examKey, it.qn)}
                      disabled={busy}
                      aria-label={`#${it.qn} 컬렉션에서 빼기`}
                      className="shrink-0 rounded p-1 text-[var(--muted)] hover:text-[var(--fg)] disabled:opacity-50"
                    >
                      <LuX className="size-4" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        ))
      )}
    </div>
  );
}
