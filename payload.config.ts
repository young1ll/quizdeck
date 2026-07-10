import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildConfig } from "payload";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { s3Storage } from "@payloadcms/storage-s3";
import { CmsUsers } from "./cms/collections/CmsUsers.ts";
import { Exams } from "./cms/collections/Exams.ts";
import { Questions } from "./cms/collections/Questions.ts";
import { Concepts } from "./cms/collections/Concepts.ts";
import { Media } from "./cms/collections/Media.ts";

// Payload CMS 설정 (ADR-0024) — 콘텐츠(문제집·문항·개념·미디어)의 런타임 소스.
//
// - 배치: 같은 Next 앱 embed(admin /cms, REST /api/cms), 같은 postgres 의 "payload" 스키마.
//   /admin(기존 커스텀 어드민)·/api/collections(학습자 컬렉션)와 경로 충돌을 피한 배치 —
//   기존 어드민 제거(3단계)까지 /cms 로 공존한다.
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
  routes: { admin: "/cms", api: "/api/cms" },
  admin: {
    user: CmsUsers.slug,
    importMap: { baseDir: dirname },
    components: {
      beforeLogin: ["@/cms/components/CmsLoginLink"],
    },
  },
  collections: [CmsUsers, Exams, Questions, Concepts, Media],
  editor: lexicalEditor(),
  // 언어 봉투(content jsonb {ko,en}) 의 대체 — 필드 단위 localized + ko 기본, 폴백 on.
  localization: { locales: ["ko", "en"], defaultLocale: "ko", fallback: true },
  db: postgresAdapter({
    pool: { connectionString: process.env.DATABASE_URL },
    schemaName: "payload",
    migrationDir: path.resolve(dirname, "db/payload-migrations"),
  }),
  graphQL: { disable: true },
  typescript: { outputFile: path.resolve(dirname, "payload-types.ts") },
  plugins: r2 ? [s3Storage({ collections: { media: true }, ...r2 })] : [],
  telemetry: false,
});
