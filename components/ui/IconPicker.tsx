"use client";

import { ICON_MAX } from "@/lib/catalog";

// 아이콘 피커 (ADR-0023) — 프리셋 팔레트 + 직접 입력(이모지 붙여넣기). 컬렉션 생성/편집과 admin
// 문제집 아이콘 편집이 공유한다. value="" = 아이콘 없음(제거 의도) — 저장 의미는 호출부가 소유.
const PRESETS = [
  "📚", "📝", "🎯", "⭐", "🔥", "💡", "🧠", "⚡",
  "🏗️", "🏛️", "☁️", "🔒", "🌐", "📊", "🗂️", "🚀",
];

export default function IconPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-8 gap-1">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onChange(value === p ? "" : p)}
            aria-label={`아이콘 ${p}`}
            aria-pressed={value === p}
            className={`flex h-9 items-center justify-center rounded-lg border text-lg ${
              value === p
                ? "border-[var(--accent)] bg-[var(--panel)]"
                : "border-[var(--border)] hover:bg-[var(--panel)]"
            }`}
          >
            {p}
          </button>
        ))}
      </div>
      <input
        value={value}
        maxLength={ICON_MAX}
        onChange={(e) => onChange(e.target.value)}
        placeholder="직접 입력 (이모지)"
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-1.5 text-sm"
      />
    </div>
  );
}
