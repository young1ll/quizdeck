"use client";

import { useStore } from "@/lib/store";
import type { SyncState } from "@/lib/progress-store-composite";

// 동기화 상태 표시 (이슈 #7). 로그인 Learner(=composite 주입)일 때만 보인다 —
// 익명(localStorage 단독)이면 useStore().syncStatus 가 null 이라 아무것도 렌더하지 않는다.

const META: Record<SyncState, { label: string; color: string }> = {
  syncing: { label: "동기화 중…", color: "var(--warn)" },
  synced: { label: "동기화됨", color: "var(--good)" },
  offline: { label: "오프라인", color: "var(--bad)" },
};

function fmtTime(ms: number): string {
  return new Date(ms).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

export default function SyncIndicator() {
  const { syncStatus } = useStore();
  if (!syncStatus) return null;

  const { state, lastSyncedAt } = syncStatus;
  const meta = META[state];
  const showTime = lastSyncedAt !== null && state !== "syncing";

  return (
    <div className="mb-3 flex justify-end">
      <div
        className="flex items-center gap-1.5 text-xs text-[var(--muted)]"
        aria-live="polite"
        title={lastSyncedAt !== null ? `마지막 동기화 ${fmtTime(lastSyncedAt)}` : undefined}
      >
        <span
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ background: meta.color }}
          aria-hidden
        />
        <span>{meta.label}</span>
        {showTime && <span>· {fmtTime(lastSyncedAt)}</span>}
      </div>
    </div>
  );
}
