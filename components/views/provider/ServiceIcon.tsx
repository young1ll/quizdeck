// provider 뷰 전용 서비스 아이콘 — exam 컨텍스트(useExam)의 Icon 과 달리 레지스트리의 유효
// 아이콘(이미지 URL 또는 데이터 URI — WP 투영이 단일 필드로 정리)을 직접 받는다.
export default function ServiceIcon({ icon, size = 32 }: { icon?: string; size?: number }) {
  if (!icon) {
    return (
      <span
        aria-hidden
        className="inline-block shrink-0 rounded bg-[var(--panel-2)]"
        style={{ width: size, height: size }}
      />
    );
  }
  return <img src={icon} alt="" width={size} height={size} loading="lazy" className="shrink-0 rounded" />;
}
