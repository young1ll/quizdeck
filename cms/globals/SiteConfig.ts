import type { GlobalConfig } from "payload";
import { adminOnly, cmsUser } from "../access.ts";

// 사이트 설정 Global (ADR-0024 확장 D). WordPress '설정'의 등가 — 앱 셸이 Local API 로 읽는
// 전역 문서 하나. 콘텐츠(컬렉션)와 달리 인스턴스가 하나라 Global 이 맞는 모델링.
// 변경은 admin 만(운영 설정 — author 는 콘텐츠 저작 전용, ADR-0024 결정 4의 경계 유지).

export const SiteConfig: GlobalConfig = {
  slug: "site-config",
  label: "사이트 설정",
  admin: { group: "시스템", description: "홈 문구·공지 배너 — 저장 즉시 사이트에 반영된다" },
  access: { read: cmsUser, update: adminOnly },
  hooks: {
    afterChange: [
      async ({ doc }) => {
        // 전역 설정은 모든 화면에 영향 — 루트 layout 스코프 통째 무효화(규모상 저렴).
        // CLI 쓰기에선 Next 캐시가 없는 게 정상(cms/revalidate.ts 와 같은 규칙).
        try {
          const { revalidatePath } = await import("next/cache");
          revalidatePath("/", "layout");
        } catch {
          /* Next 런타임 밖 */
        }
        return doc;
      },
    ],
  },
  fields: [
    {
      name: "tagline",
      type: "text",
      label: "태그라인",
      admin: { description: "홈 상단 한 줄 소개 — 비우면 기본 문구" },
    },
    {
      name: "footerText",
      type: "text",
      label: "푸터 문구",
      admin: { description: "홈 하단 — 비우면 기본 문구" },
    },
    {
      name: "notice",
      type: "group",
      label: "공지 배너",
      fields: [
        { name: "enabled", type: "checkbox", label: "표시", defaultValue: false },
        {
          name: "text",
          type: "textarea",
          label: "내용",
          admin: { condition: (data) => Boolean(data?.notice?.enabled) },
        },
        {
          name: "tone",
          type: "select",
          label: "톤",
          options: [
            { label: "안내", value: "info" },
            { label: "주의", value: "warning" },
          ],
          defaultValue: "info",
          admin: { condition: (data) => Boolean(data?.notice?.enabled) },
        },
      ],
    },
  ],
};
