"use client";

import { useExam } from "@/lib/exam-context";

/** 서비스명 → 아이콘(base64 SVG). 없으면 빈 자리표시 */
export default function Icon({
  svc,
  size = 24,
}: {
  svc: string;
  size?: number;
}) {
  const { icons } = useExam();
  const src = icons[svc];
  if (!src) {
    return (
      <span
        aria-hidden
        className="inline-block shrink-0 rounded bg-[var(--panel-2)]"
        style={{ width: size, height: size }}
      />
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={src}
      alt=""
      aria-hidden
      width={size}
      height={size}
      className="inline-block shrink-0"
      style={{ width: size, height: size }}
    />
  );
}
