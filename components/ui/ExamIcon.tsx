// 문제집 아이콘 렌더러 (ADR-0023 + 이미지 애던덤). 병합된 아이콘 값은 문자열 하나 — 이모지 또는
// 서빙 URL(/api/exam-icon/…). "/" 시작이면 <img>(텍스트 1.15em 크기로 인라인), 아니면 이모지
// span. 서버·클라 양쪽에서 쓰는 순수 표시 컴포넌트(훅 없음, "use client" 불요).
export default function ExamIcon({ icon, className }: { icon?: string; className?: string }) {
  if (!icon) return null;
  if (icon.startsWith("/")) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={icon}
        alt=""
        aria-hidden
        className={`inline-block size-[1.15em] object-contain align-[-0.2em] ${className ?? ""}`}
      />
    );
  }
  return (
    <span aria-hidden className={className}>
      {icon}
    </span>
  );
}
