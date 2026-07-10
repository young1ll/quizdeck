import { APIError, type CollectionBeforeValidateHook, type CollectionConfig } from "payload";
import { adminOnly, cmsUser } from "../access.ts";
import { revalidateExamContent, revalidateExamContentOnDelete } from "../revalidate.ts";

// 문항 (ADR-0024) — 기존 question(exam_key, qn, answer[], content jsonb{ko,en}) 테이블의 이관.
// 언어 의존 텍스트는 Payload 네이티브 localization(localized: true — ko/en, config 폴백)으로,
// jsonb 언어 봉투(content-localize)를 대체한다. 식별(qn)·검증(answer)은 언어 무관 필드.

// (exam, qn) 유일성 — 복합 unique 를 스키마로 못 걸어 훅으로 검증한다(admin 저장·REST 공용 경계).
const uniqueExamQn: CollectionBeforeValidateHook = async ({ data, originalDoc, req }) => {
  const exam = data?.exam ?? originalDoc?.exam;
  const qn = data?.qn ?? originalDoc?.qn;
  if (exam == null || qn == null) return data;
  const examId = typeof exam === "object" ? exam.id : exam;
  const dup = await req.payload.find({
    collection: "questions",
    where: {
      and: [
        { exam: { equals: examId } },
        { qn: { equals: qn } },
        ...(originalDoc?.id ? [{ id: { not_equals: originalDoc.id } }] : []),
      ],
    },
    limit: 1,
    overrideAccess: true,
  });
  if (dup.totalDocs > 0) throw new APIError(`이미 존재하는 문항 번호입니다: qn=${qn}`, 400);
  return data;
};

export const Questions: CollectionConfig = {
  slug: "questions",
  labels: { singular: "문항", plural: "문항" },
  admin: {
    group: "콘텐츠",
    defaultColumns: ["exam", "qn", "topic", "updatedAt"],
    listSearchableFields: ["q", "topic"],
  },
  access: {
    read: cmsUser,
    create: cmsUser,
    update: cmsUser,
    delete: adminOnly,
  },
  hooks: {
    beforeValidate: [uniqueExamQn],
    afterChange: [revalidateExamContent],
    afterDelete: [revalidateExamContentOnDelete],
  },
  fields: [
    { name: "exam", type: "relationship", label: "문제집", relationTo: "exams", required: true, index: true },
    { name: "qn", type: "number", label: "문항 번호", required: true, min: 1, admin: { description: "문항 번호 — 문제집 내 유일" } },
    { name: "topic", type: "text", label: "주제", localized: true, admin: { description: "예: 📦 스토리지" } },
    { name: "q", type: "textarea", label: "지문", required: true, localized: true, admin: { description: "지문 — **굵게** 마크업 허용(현행 렌더러 규칙)" } },
    {
      name: "options",
      type: "array",
      label: "보기",
      required: true,
      minRows: 2,
      admin: { description: "보기 — key(A,B,…)는 언어 무관, text 만 언어별" },
      fields: [
        { name: "key", type: "text", required: true },
        { name: "text", type: "textarea", required: true, localized: true },
      ],
    },
    {
      name: "answer",
      type: "text",
      label: "정답",
      hasMany: true,
      required: true,
      admin: { description: "정답 key 목록 — 보기 key 의 부분집합(예: A / A,C)" },
    },
    { name: "explanation", type: "textarea", label: "해설", localized: true },
    { name: "tip", type: "textarea", label: "팁", localized: true },
    // 언어 무관 참조 필드 — 구 슬롯엔 언어별로 저장됐지만 의미는 중립(덤프 페이지·원문 링크).
    // 투영(cms/read.ts)이 존재하는 모든 로케일 슬롯에 같은 값을 되돌린다.
    { name: "page", type: "number", admin: { description: "덤프 문서 페이지 번호" } },
    { name: "deeplink", type: "text", admin: { description: "원문 딥링크(예: marginnote4app://…)" } },
  ],
};
