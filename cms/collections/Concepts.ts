import { APIError, type CollectionBeforeValidateHook, type CollectionConfig } from "payload";
import { adminOnly, cmsUser } from "../access.ts";
import { revalidateExamContent, revalidateExamContentOnDelete } from "../revalidate.ts";

// 개념 카드 (ADR-0024) — 기존 concept(exam_key, svc, ord, content jsonb{ko,en}) 테이블의 이관.
// svc 는 q2svc 매핑·기존 데이터의 조인 키라 언어 무관 식별자(현행 데이터는 한국어 서비스명)로
// 유지하고, 설명 텍스트만 localized 로 뒀다.

const uniqueExamSvc: CollectionBeforeValidateHook = async ({ data, originalDoc, req }) => {
  const exam = data?.exam ?? originalDoc?.exam;
  const svc = data?.svc ?? originalDoc?.svc;
  if (exam == null || !svc) return data;
  const examId = typeof exam === "object" ? exam.id : exam;
  const dup = await req.payload.find({
    collection: "concepts",
    where: {
      and: [
        { exam: { equals: examId } },
        { svc: { equals: svc } },
        ...(originalDoc?.id ? [{ id: { not_equals: originalDoc.id } }] : []),
      ],
    },
    limit: 1,
    draft: true,
    overrideAccess: true,
  });
  if (dup.totalDocs > 0) throw new APIError(`이미 존재하는 개념입니다: svc=${svc}`, 400);
  return data;
};

export const Concepts: CollectionConfig = {
  slug: "concepts",
  labels: { singular: "개념 카드", plural: "개념 카드" },
  admin: {
    group: "콘텐츠",
    useAsTitle: "svc",
    defaultColumns: ["exam", "svc", "cat", "ord", "_status"],
    listSearchableFields: ["svc", "abbr"],
  },
  access: {
    read: cmsUser,
    create: cmsUser,
    update: cmsUser,
    delete: adminOnly,
  },
  // 드래프트·버전 (확장 C — WordPress 초안→게시·리비전의 등가). 서빙(cms/read.ts)은
  // _status=published 만 읽는다. autosave 로 편집 유실 방지, 리비전은 문서당 20개 캡.
  versions: { drafts: { autosave: true }, maxPerDoc: 20 },
  hooks: {
    beforeValidate: [uniqueExamSvc],
    afterChange: [revalidateExamContent],
    afterDelete: [revalidateExamContentOnDelete],
  },
  // 편집 화면 구성(화면 고도화) — Questions 와 같은 규칙: 식별·참조는 사이드바, 본문은 탭.
  fields: [
    // ── 사이드바: 식별·참조 (언어 무관) ──
    {
      name: "exam",
      type: "relationship",
      label: "문제집",
      relationTo: "exams",
      required: true,
      index: true,
      admin: { position: "sidebar" },
    },
    {
      name: "ord",
      type: "number",
      label: "순서",
      required: true,
      admin: { position: "sidebar", description: "목록 순서 — 편집으로 재배열되지 않게 명시 보관" },
    },
    {
      name: "rel",
      type: "number",
      hasMany: true,
      label: "관련 문항",
      admin: { position: "sidebar", description: "관련 문항 번호(표시분)" },
    },
    {
      name: "reln",
      type: "number",
      label: "관련 문항 총 개수",
      admin: { position: "sidebar" },
    },
    // ── 본문 ──
    {
      name: "svc",
      type: "text",
      label: "서비스/개념 식별자",
      required: true,
      index: true,
      admin: { description: "q2svc 조인 키(언어 무관), 예: Amazon S3 스토리지 클래스" },
    },
    {
      type: "tabs",
      tabs: [
        {
          label: "정의·핵심",
          fields: [
            {
              type: "row",
              fields: [
                { name: "cat", type: "text", label: "분류", localized: true, admin: { description: "예: 스토리지" } },
                { name: "abbr", type: "text", label: "축약", localized: true, admin: { description: "예: S3 Classes" } },
              ],
            },
            { name: "deff", type: "textarea", label: "정의", required: true, localized: true },
            { name: "key", type: "textarea", label: "핵심 포인트", localized: true },
            { name: "when", type: "textarea", label: "언제 쓰나", localized: true },
          ],
        },
        {
          label: "함정·비교",
          fields: [
            { name: "trap", type: "textarea", label: "함정", localized: true },
            { name: "vs", type: "textarea", label: "비교", localized: true },
            { name: "detail", type: "textarea", label: "상세(선택)", localized: true },
            { name: "cost", type: "textarea", label: "비용 특성(선택)", localized: true },
          ],
        },
      ],
    },
  ],
};
