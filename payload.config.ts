import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildConfig } from "payload";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { s3Storage } from "@payloadcms/storage-s3";
import { importExportPlugin } from "@payloadcms/plugin-import-export";
import { importJsonEndpoint } from "./cms/import-endpoint.ts";
import { en } from "@payloadcms/translations/languages/en";
import { ko } from "@payloadcms/translations/languages/ko";
import { CmsUsers } from "./cms/collections/CmsUsers.ts";
import { Exams } from "./cms/collections/Exams.ts";
import { Questions } from "./cms/collections/Questions.ts";
import { Concepts } from "./cms/collections/Concepts.ts";
import { Media } from "./cms/collections/Media.ts";
import { SiteConfig } from "./cms/globals/SiteConfig.ts";

// Payload CMS 설정 (ADR-0024) — 콘텐츠(문제집·문항·개념·미디어)의 런타임 소스.
//
// - 배치: 같은 Next 앱 embed(admin /admin — 3단계에서 구 커스텀 어드민을 제거하며 이양,
//   REST /api/cms — /api/collections(학습자 컬렉션) 충돌 회피), 같은 postgres 의 "payload" 스키마.
// - 인증: better-auth 세션 전략(cms/auth-strategy) — 로컬 인증 없음, PAYLOAD_SECRET 은
//   Payload 내부 토큰 서명용으로만 쓰인다(k8s Secret 주입 — 빌드 시점 부재는 정상,
//   BETTER_AUTH_SECRET 과 같은 규칙: 런타임 요청에서 비로소 필요).
// - 마이그레이션: db/payload-migrations/ — 수기 SQL(db/migrations/)과 같은 규율로
//   배포 전 수동 적용(pnpm payload migrate). dev push 는 로컬 임시 DB 에서만.

const dirname = path.dirname(fileURLToPath(import.meta.url));

// R2 미디어 스토리지(ADR-0021 의 R2 계정 재사용, 버킷은 media 전용) — env 4종이 모두 있을
// 때만 켠다(소셜 로그인 자격증명과 같은 조건부 규칙). 부재 시 로컬 디스크(./media, dev 전용).
const r2 =
  process.env.R2_MEDIA_BUCKET &&
  process.env.R2_MEDIA_ENDPOINT &&
  process.env.R2_MEDIA_ACCESS_KEY_ID &&
  process.env.R2_MEDIA_SECRET_ACCESS_KEY
    ? {
        bucket: process.env.R2_MEDIA_BUCKET,
        config: {
          endpoint: process.env.R2_MEDIA_ENDPOINT,
          region: "auto",
          credentials: {
            accessKeyId: process.env.R2_MEDIA_ACCESS_KEY_ID,
            secretAccessKey: process.env.R2_MEDIA_SECRET_ACCESS_KEY,
          },
        },
      }
    : null;

export default buildConfig({
  secret: process.env.PAYLOAD_SECRET || "",
  // 3단계: 커스텀 어드민 제거와 함께 /admin 이양(Q8 합의). REST 는 /api/cms 유지 —
  // /api/admin/* 은 제거된 구 표면이고, /api/collections(학습자 컬렉션) 충돌 회피는 그대로.
  routes: { admin: "/admin", api: "/api/cms" },
  admin: {
    user: CmsUsers.slug,
    importMap: { baseDir: dirname },
    meta: { titleSuffix: " · QuizDeck CMS" },
    components: {
      beforeLogin: ["@/cms/components/CmsLoginLink"],
      beforeDashboard: ["@/cms/components/DashboardStats"],
      afterNavLinks: ["@/cms/components/UsersNavLink"],
      graphics: {
        Logo: "@/cms/components/Logo",
        Icon: "@/cms/components/LogoIcon",
      },
      // 사용자 관리 커스텀 뷰 (확장 B — ADR-0017 부분 재개봉): 밴·롤 변경 인앱화,
      // 파괴 조작(삭제·세션)은 hosted 대시보드 유지.
      views: {
        users: { Component: "@/cms/components/UsersView", path: "/users" },
        import: { Component: "@/cms/components/ImportView", path: "/import" },
      },
    },
  },
  // admin UI 언어 — 한국어 기본(사용자별 계정 설정에서 변경 가능). (확장 E)
  i18n: { supportedLanguages: { en, ko }, fallbackLanguage: "ko" },
  collections: [CmsUsers, Exams, Questions, Concepts, Media],
  globals: [SiteConfig],
  editor: lexicalEditor(),
  // 언어 봉투(content jsonb {ko,en}) 의 대체 — 필드 단위 localized + ko 기본, 폴백 on.
  localization: { locales: ["ko", "en"], defaultLocale: "ko", fallback: true },
  db: postgresAdapter({
    pool: { connectionString: process.env.DATABASE_URL },
    schemaName: "payload",
    migrationDir: path.resolve(dirname, "db/payload-migrations"),
    // dev push 금지 — 스키마 변경은 항상 마이그레이션 파일로(관례). 특히 payload run 스크립트가
    // 터널로 운영 DB 를 가리킬 때 조용한 push·payload_migrations 'dev' 마커(이후 migrate 가
    // 인터랙티브 프롬프트로 멈추는 원인)를 차단한다. 로컬 dev 도 pnpm payload migrate 로 적용.
    push: false,
  }),
  // 구 JSON 포맷 대량 반입(2차 확장 C - 원자적, 초안 생성) - POST /api/cms/import-json
  endpoints: [importJsonEndpoint],
  graphQL: { disable: true },
  typescript: { outputFile: path.resolve(dirname, "payload-types.ts") },
  plugins: [
    // 반출(2차 확장 C①) — 목록 뷰에 CSV/JSON 내보내기. jobs 큐 없이 동기 실행(단일 pod,
    // 큐 러너 미상주). 반입은 커스텀 /admin/import(구 JSON 포맷 전용 — cms/import-endpoint).
    importExportPlugin({
      collections: (["questions", "concepts", "exams"] as const).map((slug) => ({
        slug,
        // 동기 실행(jobs 큐 러너 미상주 — 단일 pod). 반입은 커스텀 뷰가 담당하므로 plugin import 비활성.
        export: { disableJobsQueue: true },
        import: false,
      })),
    }),
    ...(r2 ? [s3Storage({ collections: { media: true }, ...r2 })] : []),
  ],
  telemetry: false,
});
