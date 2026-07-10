// 사이트 공지 배너 (ADR-0024 확장 D) — CMS 사이트 설정(notice)이 켜졌을 때 learner 셸 상단에.
// 표시 여부·문구는 서버(layout)가 Global 에서 읽어 내려준다 — 여긴 순수 표시.
export default function NoticeBanner({
  text,
  tone,
}: {
  text: string;
  tone: "info" | "warning";
}) {
  return (
    <div
      role="status"
      className="border-b border-[var(--border)] px-4 py-2 text-center text-sm"
      style={{ color: tone === "warning" ? "var(--danger, #b45309)" : "var(--accent)" }}
    >
      {tone === "warning" ? "⚠️ " : ""}
      {text}
    </div>
  );
}
