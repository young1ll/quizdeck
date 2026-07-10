import { APIError, type CollectionBeforeValidateHook, type CollectionConfig } from "payload";
import { adminOnly, cmsUser } from "../access.ts";

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
    overrideAccess: true,
  });
  if (dup.totalDocs > 0) throw new APIError(`이미 존재하는 개념입니다: svc=${svc}`, 400);
  return data;
};

export const Concepts: CollectionConfig = {
  slug: "concepts",
  admin: {
    useAsTitle: "svc",
    defaultColumns: ["exam", "svc", "cat", "ord"],
    listSearchableFields: ["svc", "abbr"],
  },
  access: {
    read: cmsUser,
    create: cmsUser,
    update: cmsUser,
    delete: adminOnly,
  },
  hooks: { beforeValidate: [uniqueExamSvc] },
  fields: [
    { name: "exam", type: "relationship", relationTo: "exams", required: true, index: true },
    {
      name: "svc",
      type: "text",
      required: true,
      index: true,
      admin: { description: "서비스/개념 식별자 — q2svc 조인 키(언어 무관), 예: Amazon S3 스토리지 클래스" },
    },
    {
      name: "ord",
      type: "number",
      required: true,
      admin: { description: "목록 순서 — 편집으로 재배열되지 않게 명시 보관(0003 ord 계승)" },
    },
    { name: "cat", type: "text", localized: true, admin: { description: "분류, 예: 스토리지" } },
    { name: "abbr", type: "text", localized: true, admin: { description: "축약 표기, 예: S3 Classes" } },
    { name: "deff", type: "textarea", required: true, localized: true, admin: { description: "정의" } },
    { name: "key", type: "textarea", localized: true, admin: { description: "핵심 포인트" } },
    { name: "when", type: "textarea", localized: true, admin: { description: "언제 쓰나" } },
    { name: "trap", type: "textarea", localized: true, admin: { description: "함정" } },
    { name: "vs", type: "textarea", localized: true, admin: { description: "비교" } },
  ],
};
