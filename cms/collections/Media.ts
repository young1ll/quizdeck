import type { CollectionConfig } from "payload";
import { adminOnly, cmsUser } from "../access.ts";

// 미디어 (ADR-0024) — 문제집 아이콘 이미지(exam_icon_override.image bytea 의 이관처)와 향후
// 지문 이미지. 저장은 R2(payload.config 의 s3Storage — env 부재 시 로컬 디스크 폴백, dev 전용).
// mime 화이트리스트는 기존 parseIconImage(lib/icon-image.ts) 규칙 계승. sharp 미도입 —
// 리사이즈/크롭 없음(아이콘 ≤256KB 수준이라 원본 서빙으로 충분, 이미지 슬림 유지).
export const Media: CollectionConfig = {
  slug: "media",
  upload: {
    staticDir: "media",
    crop: false,
    focalPoint: false,
    mimeTypes: ["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"],
  },
  access: {
    read: () => true, // 아이콘은 익명 카탈로그(home)에 노출 — 공개 read (현행 /api/exam-icon 과 동일)
    create: cmsUser,
    update: cmsUser,
    delete: adminOnly,
  },
  fields: [{ name: "alt", type: "text" }],
};
