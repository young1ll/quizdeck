"use client";

import { StatusDot } from "@astryxdesign/core/StatusDot";
import { useStore } from "@/lib/store";
import type { SyncState } from "@/lib/progress-store-composite";

// 동기화 상태 표시 (이슈 #7) — astryx StatusDot 래퍼 (ADR-0014 Phase 2). 로그인 Learner(=composite
// 주입)일 때만 보인다 — 익명(localStorage 단독)이면 useStore().syncStatus 가 null 이라 미렌더.
// StatusDot(색 점): syncing→warning(pulsing)·synced→success·offline→error, label 은 **aria-label 전용**
// (시각 텍스트 없음)이라 라벨은 옆에 aria-hidden 텍스트로 별도 렌더(시각 유지) — SR 은 StatusDot 이 1회
// announce. aria-live 는 래퍼(상태 변화 announce). 마지막 동기화 시각은 라벨 접미 + tooltip.

const META: Record<SyncState, { variant: "warning" | "success" | "error"; label: string }> = {
  syncing: { variant: "warning", label: "동기화 중…" },
  synced: { variant: "success", label: "동기화됨" },
  offline: { variant: "error", label: "오프라인" },
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
  const label = showTime ? `${meta.label} · ${fmtTime(lastSyncedAt!)}` : meta.label;

  return (
    <div className="mb-3 flex justify-end" aria-live="polite">
      <span className="flex items-center gap-1.5">
        <StatusDot
          variant={meta.variant}
          label={label}
          isPulsing={state === "syncing"}
          tooltip={lastSyncedAt !== null ? `마지막 동기화 ${fmtTime(lastSyncedAt)}` : undefined}
        />
        <span aria-hidden className="text-xs text-[var(--muted)]">
          {label}
        </span>
      </span>
    </div>
  );
}
