// 아이콘 이미지 경계 검증 (ADR-0023 애던덤). 순수(no pg) — admin API 가 업로드 바이트를 신뢰하지
// 않고 이걸로만 받는다(parseIcon·parseCollection 과 같은 결). mime 화이트리스트 + 크기 캡 +
// 매직 바이트로 mime-내용 불일치를 거부한다. SVG 는 텍스트라 매직 대신 루트 태그 검사 —
// 스크립트 실행은 서빙 경로(<img> + nosniff + CSP default-src 'none')가 차단한다.

export const ICON_IMAGE_MAX_BYTES = 256 * 1024; // 256KB — 카탈로그 아이콘 용도의 여유 상한

export const ICON_IMAGE_MIMES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
] as const;
export type IconImageMime = (typeof ICON_IMAGE_MIMES)[number];

function startsWith(bytes: Uint8Array, sig: number[], offset = 0): boolean {
  return sig.every((b, i) => bytes[offset + i] === b);
}

function matchesMagic(bytes: Uint8Array, mime: IconImageMime): boolean {
  switch (mime) {
    case "image/png":
      return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47]); // ‰PNG
    case "image/jpeg":
      return startsWith(bytes, [0xff, 0xd8, 0xff]);
    case "image/webp":
      return startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8); // RIFF…WEBP
    case "image/gif":
      return startsWith(bytes, [0x47, 0x49, 0x46, 0x38]); // GIF8
    case "image/svg+xml": {
      // 텍스트 포맷 — BOM/공백 허용 후 <svg 또는 <?xml 로 시작해야 한다.
      const head = new TextDecoder("utf-8", { fatal: false })
        .decode(bytes.slice(0, 512))
        .replace(/^﻿/, "")
        .trimStart()
        .toLowerCase();
      return head.startsWith("<svg") || head.startsWith("<?xml");
    }
  }
}

export function parseIconImage(
  bytes: Uint8Array,
  mime: unknown,
): { ok: true; mime: IconImageMime } | { ok: false; error: string } {
  if (typeof mime !== "string" || !(ICON_IMAGE_MIMES as readonly string[]).includes(mime))
    return { ok: false, error: "unsupported mime" };
  const m = mime as IconImageMime;
  if (bytes.length === 0) return { ok: false, error: "empty image" };
  if (bytes.length > ICON_IMAGE_MAX_BYTES) return { ok: false, error: "image too large" };
  if (!matchesMagic(bytes, m)) return { ok: false, error: "content does not match mime" };
  return { ok: true, mime: m };
}
