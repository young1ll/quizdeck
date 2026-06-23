import { renderMarkdown } from "@/lib/md";

// 미니 마크다운(굵게/코드/줄바꿈)을 안전하게 렌더
export default function Markdown({
  text,
  className = "",
}: {
  text?: string;
  className?: string;
}) {
  if (!text) return null;
  return (
    <span
      className={`md ${className}`}
      dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }}
    />
  );
}
