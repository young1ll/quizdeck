import { describe, expect, it } from "vitest";
import { parseIconImage, ICON_IMAGE_MAX_BYTES } from "./icon-image";

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');

describe("parseIconImage (아이콘 이미지 경계 — ADR-0023 애던덤)", () => {
  it("mime 화이트리스트 + 매직 바이트 일치만 통과", () => {
    expect(parseIconImage(png, "image/png")).toEqual({ ok: true, mime: "image/png" });
    expect(parseIconImage(svg, "image/svg+xml")).toEqual({ ok: true, mime: "image/svg+xml" });
    // 선행 XML 선언·공백 허용
    expect(
      parseIconImage(new TextEncoder().encode('  <?xml version="1.0"?><svg/>'), "image/svg+xml").ok,
    ).toBe(true);
  });

  it("mime-내용 불일치·미지원 mime·빈 바이트는 거부", () => {
    expect(parseIconImage(png, "image/jpeg")).toEqual({ ok: false, error: "content does not match mime" });
    expect(parseIconImage(svg, "image/png").ok).toBe(false);
    expect(parseIconImage(png, "text/html")).toEqual({ ok: false, error: "unsupported mime" });
    expect(parseIconImage(png, undefined)).toEqual({ ok: false, error: "unsupported mime" });
    expect(parseIconImage(new Uint8Array(), "image/png")).toEqual({ ok: false, error: "empty image" });
  });

  it("크기 캡 초과는 거부", () => {
    const big = new Uint8Array(ICON_IMAGE_MAX_BYTES + 1);
    big.set([0x89, 0x50, 0x4e, 0x47]);
    expect(parseIconImage(big, "image/png")).toEqual({ ok: false, error: "image too large" });
  });

  it("webp 는 RIFF+WEBP 이중 시그니처를 요구", () => {
    const webp = new Uint8Array(16);
    webp.set([0x52, 0x49, 0x46, 0x46], 0);
    webp.set([0x57, 0x45, 0x42, 0x50], 8);
    expect(parseIconImage(webp, "image/webp").ok).toBe(true);
    const riffOnly = new Uint8Array(16);
    riffOnly.set([0x52, 0x49, 0x46, 0x46], 0);
    expect(parseIconImage(riffOnly, "image/webp").ok).toBe(false);
  });
});
