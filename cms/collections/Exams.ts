import type { CollectionConfig } from "payload";
import { adminOnly, cmsUser } from "../access.ts";
import { revalidateExamDoc, revalidateExamDocOnDelete } from "../revalidate.ts";
import { ICON_MAX } from "../../lib/catalog.ts";

// 문제집(Exam) 카탈로그 (ADR-0024) — content/<provider>/<slug>/meta.json 의 DB 이관.
// examKey("aws/saa-c03")는 progress·annotation 등 기존 테이블의 exam_key 스코프 문자열과
// 동일 규칙 — provider/slug 에서 파생하고 unique 로 고정한다.
export const Exams: CollectionConfig = {
  slug: "exams",
  labels: { singular: "문제집", plural: "문제집" },
  admin: {
    group: "콘텐츠",
    useAsTitle: "name",
    defaultColumns: ["name", "examKey", "code", "language"],
  },
  access: {
    read: cmsUser,
    create: cmsUser,
    update: cmsUser,
    delete: adminOnly, // 문제집 삭제 = 파괴적(하위 문항 고아화) — admin 만
  },
  hooks: {
    afterChange: [revalidateExamDoc],
    afterDelete: [revalidateExamDocOnDelete],
  },
  fields: [
    { name: "provider", type: "text", required: true, admin: { description: "예: aws" } },
    { name: "slug", type: "text", required: true, admin: { description: "예: saa-c03" } },
    {
      name: "examKey",
      type: "text",
      unique: true,
      index: true,
      admin: { readOnly: true, description: "provider/slug 파생 — 기존 exam_key 스코프와 동일" },
      hooks: {
        beforeValidate: [
          ({ data }) =>
            data?.provider && data?.slug ? `${data.provider}/${data.slug}` : undefined,
        ],
      },
    },
    { name: "providerName", type: "text", required: true },
    { name: "code", type: "text", required: true, admin: { description: "예: SAA-C03" } },
    { name: "name", type: "text", label: "이름", required: true },
    {
      name: "language",
      type: "select",
      options: ["ko", "en"],
      defaultValue: "ko",
      required: true,
      admin: { description: "문제집의 기본 표시 언어(meta.language)" },
    },
    {
      name: "icon",
      type: "text",
      label: "아이콘(이모지)",
      validate: (value: string | null | undefined) =>
        !value || value.trim().length <= ICON_MAX || `이모지 ${ICON_MAX} UTF-16 유닛 이하`,
      admin: { description: "이모지 — 이미지 아이콘은 iconImage(둘 다 있으면 이미지 우선)" },
    },
    { name: "iconImage", type: "upload", relationTo: "media" },
    // track — 자격 계열(카탈로그 그룹핑 키, 없으면 provider 폴백). group 이 아닌 평탄 필드인
    // 이유: Payload 는 "id" 가 예약 필드명이라(group 안에서도) track.id 를 표현할 수 없다 —
    // 조용히 드롭되는 함정. 로더(3단계)가 { id: trackId, name: trackName } 으로 재조립한다.
    {
      name: "trackId",
      type: "text",
      admin: { description: "자격 계열 안정 id, 예: aws-solutions-architect — 없으면 provider 로 그룹핑" },
    },
    { name: "trackName", type: "text", admin: { description: "자격 계열 표시명" } },
    // 코드성 산출물 — 개발자가 만드는 구조화 JSON. CMS 편집 UX 는 없지만 단일 소스는 지킨다(ADR-0024).
    { name: "diagrams", type: "json", admin: { description: "diagrams.json 원형" } },
    { name: "q2svc", type: "json", admin: { description: "q2svc.json 원형 — qn → svc[]" } },
    { name: "svcIcons", type: "json", admin: { description: "icons.json 원형 — svc → 아이콘" } },
  ],
};
