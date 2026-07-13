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
    draft: true,
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
    defaultColumns: ["exam", "qn", "topic", "_status", "updatedAt"],
    groupBy: true, // 목록을 문제집 등 필드로 그룹핑(화면 고도화 PR-1)
    listSearchableFields: ["q", "topic"],
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
    beforeValidate: [uniqueExamQn],
    afterChange: [revalidateExamContent],
    afterDelete: [revalidateExamContentOnDelete],
  },
  // 편집 화면 구성(화면 고도화): 무명 tabs·position:sidebar 는 순수 표현 계층 — 데이터 형태·
  // 스키마 불변(리허설 migrate:create 로 no-diff 확인). 식별·참조(언어 무관)는 사이드바,
  // 본문은 "내용"/"해설·팁" 탭.
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
      name: "qn",
      type: "number",
      label: "문항 번호",
      required: true,
      min: 1,
      admin: { position: "sidebar", description: "문제집 내 유일" },
    },
    {
      name: "page",
      type: "number",
      label: "페이지",
      admin: { position: "sidebar", description: "덤프 문서 페이지 번호" },
    },
    {
      name: "deeplink",
      type: "text",
      label: "딥링크",
      admin: { position: "sidebar", description: "원문 링크(예: marginnote4app://…)" },
    },
    // ── 본문 탭 ──
    {
      type: "tabs",
      tabs: [
        {
          label: "내용",
          fields: [
            { name: "topic", type: "text", label: "주제", localized: true, admin: { description: "예: 📦 스토리지" } },
            {
              name: "q",
              type: "textarea",
              label: "지문",
              required: true,
              localized: true,
              admin: { description: "**굵게** 마크업 허용(현행 렌더러 규칙)" },
            },
            {
              name: "image",
              type: "upload",
              relationTo: "media",
              label: "지문 이미지",
              admin: { description: "지문 아래 표시 — 선택 (ADR-0024 확장 F)" },
            },
            {
              name: "options",
              type: "array",
              label: "보기",
              required: true,
              minRows: 2,
              admin: { description: "key(A,B,…)는 언어 무관, text 만 언어별" },
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
          ],
        },
        {
          label: "해설·팁",
          fields: [
            { name: "explanation", type: "textarea", label: "해설", localized: true },
            { name: "tip", type: "textarea", label: "팁", localized: true },
          ],
        },
      ],
    },
  ],
};
