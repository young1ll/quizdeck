import React from "react";
import type { AdminViewServerProps } from "payload";
import { DefaultTemplate } from "@payloadcms/next/templates";
import { Gutter } from "@payloadcms/ui";
import ImportForm from "./ImportForm.tsx";

// JSON 대량 반입 뷰 (2차 확장 C①) — /admin/import. cms 사용자(admin|author) 전부 사용 가능
// (반입 = 저작 행위). 대상 문제집 목록은 서버가 내려주고, 업로드·정책 안내는 ImportForm.
export default async function ImportView({ initPageResult, params, searchParams }: AdminViewServerProps) {
  const payload = initPageResult.req.payload;
  const exams = await payload.find({
    collection: "exams",
    pagination: false,
    depth: 0,
    joins: false,
    draft: true,
    overrideAccess: true,
  });

  return (
    <DefaultTemplate
      i18n={initPageResult.req.i18n}
      locale={initPageResult.locale}
      params={params}
      payload={initPageResult.req.payload}
      permissions={initPageResult.permissions}
      searchParams={searchParams}
      user={initPageResult.req.user || undefined}
      visibleEntities={initPageResult.visibleEntities}
    >
      <Gutter>
        <h1 style={{ margin: "0.5rem 0 0.3rem" }}>JSON 반입</h1>
        <p style={{ color: "var(--theme-elevation-600)", fontSize: "0.85rem", marginBottom: "1rem" }}>
          구 <code>questions.json</code>/<code>concepts.json</code> 포맷 배열을 업로드하면{" "}
          <strong>전부 초안</strong>으로 생성됩니다(검토 후 게시). 검증 실패·qn/svc 충돌이 하나라도
          있으면 <strong>아무것도 반입되지 않고</strong> 에러 목록이 표시됩니다.
        </p>
        <ImportForm
          exams={exams.docs.map((e) => ({
            id: e.id,
            label: `${e.icon ? `${e.icon} ` : ""}${e.code} — ${e.name}`,
          }))}
        />
      </Gutter>
    </DefaultTemplate>
  );
}
