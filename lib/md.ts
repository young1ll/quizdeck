// 아주 작은 마크다운 렌더러: **굵게**, `코드`, 줄바꿈만 지원.
// 먼저 HTML을 이스케이프한 뒤 제한된 패턴만 태그로 치환하므로 XSS 안전하다.
export function renderMarkdown(src: string): string {
  if (!src) return "";
  const esc = src
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return esc
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\n/g, "<br/>");
}
