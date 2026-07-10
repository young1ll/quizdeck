import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "payload"."enum_exams_status" AS ENUM('draft', 'published');
  CREATE TYPE "payload"."enum__exams_v_version_language" AS ENUM('ko', 'en');
  CREATE TYPE "payload"."enum__exams_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "payload"."enum__exams_v_published_locale" AS ENUM('ko', 'en');
  CREATE TYPE "payload"."enum_questions_status" AS ENUM('draft', 'published');
  CREATE TYPE "payload"."enum__questions_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "payload"."enum__questions_v_published_locale" AS ENUM('ko', 'en');
  CREATE TYPE "payload"."enum_concepts_status" AS ENUM('draft', 'published');
  CREATE TYPE "payload"."enum__concepts_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "payload"."enum__concepts_v_published_locale" AS ENUM('ko', 'en');
  CREATE TABLE "payload"."_exams_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_provider" varchar,
  	"version_slug" varchar,
  	"version_exam_key" varchar,
  	"version_provider_name" varchar,
  	"version_code" varchar,
  	"version_name" varchar,
  	"version_language" "payload"."enum__exams_v_version_language" DEFAULT 'ko',
  	"version_icon" varchar,
  	"version_icon_image_id" integer,
  	"version_track_id" varchar,
  	"version_track_name" varchar,
  	"version_diagrams" jsonb,
  	"version_q2svc" jsonb,
  	"version_svc_icons" jsonb,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "payload"."enum__exams_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"snapshot" boolean,
  	"published_locale" "payload"."enum__exams_v_published_locale",
  	"latest" boolean,
  	"autosave" boolean
  );
  
  CREATE TABLE "payload"."_questions_v_version_options" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "payload"."_questions_v_version_options_locales" (
  	"text" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "payload"."_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "payload"."_questions_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_exam_id" integer,
  	"version_qn" numeric,
  	"version_page" numeric,
  	"version_deeplink" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "payload"."enum__questions_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"snapshot" boolean,
  	"published_locale" "payload"."enum__questions_v_published_locale",
  	"latest" boolean,
  	"autosave" boolean
  );
  
  CREATE TABLE "payload"."_questions_v_locales" (
  	"version_topic" varchar,
  	"version_q" varchar,
  	"version_explanation" varchar,
  	"version_tip" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "payload"."_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "payload"."_questions_v_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "payload"."_concepts_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_exam_id" integer,
  	"version_svc" varchar,
  	"version_ord" numeric,
  	"version_reln" numeric,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "payload"."enum__concepts_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"snapshot" boolean,
  	"published_locale" "payload"."enum__concepts_v_published_locale",
  	"latest" boolean,
  	"autosave" boolean
  );
  
  CREATE TABLE "payload"."_concepts_v_locales" (
  	"version_cat" varchar,
  	"version_abbr" varchar,
  	"version_deff" varchar,
  	"version_key" varchar,
  	"version_when" varchar,
  	"version_trap" varchar,
  	"version_vs" varchar,
  	"version_detail" varchar,
  	"version_cost" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "payload"."_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "payload"."_concepts_v_numbers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"number" numeric,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL
  );
  
  ALTER TABLE "payload"."exams" ALTER COLUMN "provider" DROP NOT NULL;
  ALTER TABLE "payload"."exams" ALTER COLUMN "slug" DROP NOT NULL;
  ALTER TABLE "payload"."exams" ALTER COLUMN "provider_name" DROP NOT NULL;
  ALTER TABLE "payload"."exams" ALTER COLUMN "code" DROP NOT NULL;
  ALTER TABLE "payload"."exams" ALTER COLUMN "name" DROP NOT NULL;
  ALTER TABLE "payload"."exams" ALTER COLUMN "language" DROP NOT NULL;
  ALTER TABLE "payload"."questions_options" ALTER COLUMN "key" DROP NOT NULL;
  ALTER TABLE "payload"."questions_options_locales" ALTER COLUMN "text" DROP NOT NULL;
  ALTER TABLE "payload"."questions" ALTER COLUMN "exam_id" DROP NOT NULL;
  ALTER TABLE "payload"."questions" ALTER COLUMN "qn" DROP NOT NULL;
  ALTER TABLE "payload"."questions_locales" ALTER COLUMN "q" DROP NOT NULL;
  ALTER TABLE "payload"."concepts" ALTER COLUMN "exam_id" DROP NOT NULL;
  ALTER TABLE "payload"."concepts" ALTER COLUMN "svc" DROP NOT NULL;
  ALTER TABLE "payload"."concepts" ALTER COLUMN "ord" DROP NOT NULL;
  ALTER TABLE "payload"."concepts_locales" ALTER COLUMN "deff" DROP NOT NULL;
  ALTER TABLE "payload"."exams" ADD COLUMN "_status" "payload"."enum_exams_status" DEFAULT 'draft';
  ALTER TABLE "payload"."questions" ADD COLUMN "_status" "payload"."enum_questions_status" DEFAULT 'draft';
  ALTER TABLE "payload"."concepts" ADD COLUMN "_status" "payload"."enum_concepts_status" DEFAULT 'draft';
  -- 기존 행 = 지금까지 라이브 서빙되던 게시본 — draft 기본값을 두면 서빙(_status=published 필터)에서
  -- 전부 사라진다(수동 추가 — generator 는 데이터 백필을 만들지 않는다).
  UPDATE "payload"."exams" SET "_status" = 'published';
  UPDATE "payload"."questions" SET "_status" = 'published';
  UPDATE "payload"."concepts" SET "_status" = 'published';
  ALTER TABLE "payload"."_exams_v" ADD CONSTRAINT "_exams_v_parent_id_exams_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."exams"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_exams_v" ADD CONSTRAINT "_exams_v_version_icon_image_id_media_id_fk" FOREIGN KEY ("version_icon_image_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_questions_v_version_options" ADD CONSTRAINT "_questions_v_version_options_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_questions_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_questions_v_version_options_locales" ADD CONSTRAINT "_questions_v_version_options_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_questions_v_version_options"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_questions_v" ADD CONSTRAINT "_questions_v_parent_id_questions_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."questions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_questions_v" ADD CONSTRAINT "_questions_v_version_exam_id_exams_id_fk" FOREIGN KEY ("version_exam_id") REFERENCES "payload"."exams"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_questions_v_locales" ADD CONSTRAINT "_questions_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_questions_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_questions_v_texts" ADD CONSTRAINT "_questions_v_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."_questions_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_concepts_v" ADD CONSTRAINT "_concepts_v_parent_id_concepts_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."concepts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_concepts_v" ADD CONSTRAINT "_concepts_v_version_exam_id_exams_id_fk" FOREIGN KEY ("version_exam_id") REFERENCES "payload"."exams"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_concepts_v_locales" ADD CONSTRAINT "_concepts_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_concepts_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_concepts_v_numbers" ADD CONSTRAINT "_concepts_v_numbers_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."_concepts_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "_exams_v_parent_idx" ON "payload"."_exams_v" USING btree ("parent_id");
  CREATE INDEX "_exams_v_version_version_exam_key_idx" ON "payload"."_exams_v" USING btree ("version_exam_key");
  CREATE INDEX "_exams_v_version_version_icon_image_idx" ON "payload"."_exams_v" USING btree ("version_icon_image_id");
  CREATE INDEX "_exams_v_version_version_updated_at_idx" ON "payload"."_exams_v" USING btree ("version_updated_at");
  CREATE INDEX "_exams_v_version_version_created_at_idx" ON "payload"."_exams_v" USING btree ("version_created_at");
  CREATE INDEX "_exams_v_version_version__status_idx" ON "payload"."_exams_v" USING btree ("version__status");
  CREATE INDEX "_exams_v_created_at_idx" ON "payload"."_exams_v" USING btree ("created_at");
  CREATE INDEX "_exams_v_updated_at_idx" ON "payload"."_exams_v" USING btree ("updated_at");
  CREATE INDEX "_exams_v_snapshot_idx" ON "payload"."_exams_v" USING btree ("snapshot");
  CREATE INDEX "_exams_v_published_locale_idx" ON "payload"."_exams_v" USING btree ("published_locale");
  CREATE INDEX "_exams_v_latest_idx" ON "payload"."_exams_v" USING btree ("latest");
  CREATE INDEX "_exams_v_autosave_idx" ON "payload"."_exams_v" USING btree ("autosave");
  CREATE INDEX "_questions_v_version_options_order_idx" ON "payload"."_questions_v_version_options" USING btree ("_order");
  CREATE INDEX "_questions_v_version_options_parent_id_idx" ON "payload"."_questions_v_version_options" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_questions_v_version_options_locales_locale_parent_id_unique" ON "payload"."_questions_v_version_options_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_questions_v_parent_idx" ON "payload"."_questions_v" USING btree ("parent_id");
  CREATE INDEX "_questions_v_version_version_exam_idx" ON "payload"."_questions_v" USING btree ("version_exam_id");
  CREATE INDEX "_questions_v_version_version_updated_at_idx" ON "payload"."_questions_v" USING btree ("version_updated_at");
  CREATE INDEX "_questions_v_version_version_created_at_idx" ON "payload"."_questions_v" USING btree ("version_created_at");
  CREATE INDEX "_questions_v_version_version__status_idx" ON "payload"."_questions_v" USING btree ("version__status");
  CREATE INDEX "_questions_v_created_at_idx" ON "payload"."_questions_v" USING btree ("created_at");
  CREATE INDEX "_questions_v_updated_at_idx" ON "payload"."_questions_v" USING btree ("updated_at");
  CREATE INDEX "_questions_v_snapshot_idx" ON "payload"."_questions_v" USING btree ("snapshot");
  CREATE INDEX "_questions_v_published_locale_idx" ON "payload"."_questions_v" USING btree ("published_locale");
  CREATE INDEX "_questions_v_latest_idx" ON "payload"."_questions_v" USING btree ("latest");
  CREATE INDEX "_questions_v_autosave_idx" ON "payload"."_questions_v" USING btree ("autosave");
  CREATE UNIQUE INDEX "_questions_v_locales_locale_parent_id_unique" ON "payload"."_questions_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_questions_v_texts_order_parent" ON "payload"."_questions_v_texts" USING btree ("order","parent_id");
  CREATE INDEX "_concepts_v_parent_idx" ON "payload"."_concepts_v" USING btree ("parent_id");
  CREATE INDEX "_concepts_v_version_version_exam_idx" ON "payload"."_concepts_v" USING btree ("version_exam_id");
  CREATE INDEX "_concepts_v_version_version_svc_idx" ON "payload"."_concepts_v" USING btree ("version_svc");
  CREATE INDEX "_concepts_v_version_version_updated_at_idx" ON "payload"."_concepts_v" USING btree ("version_updated_at");
  CREATE INDEX "_concepts_v_version_version_created_at_idx" ON "payload"."_concepts_v" USING btree ("version_created_at");
  CREATE INDEX "_concepts_v_version_version__status_idx" ON "payload"."_concepts_v" USING btree ("version__status");
  CREATE INDEX "_concepts_v_created_at_idx" ON "payload"."_concepts_v" USING btree ("created_at");
  CREATE INDEX "_concepts_v_updated_at_idx" ON "payload"."_concepts_v" USING btree ("updated_at");
  CREATE INDEX "_concepts_v_snapshot_idx" ON "payload"."_concepts_v" USING btree ("snapshot");
  CREATE INDEX "_concepts_v_published_locale_idx" ON "payload"."_concepts_v" USING btree ("published_locale");
  CREATE INDEX "_concepts_v_latest_idx" ON "payload"."_concepts_v" USING btree ("latest");
  CREATE INDEX "_concepts_v_autosave_idx" ON "payload"."_concepts_v" USING btree ("autosave");
  CREATE UNIQUE INDEX "_concepts_v_locales_locale_parent_id_unique" ON "payload"."_concepts_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_concepts_v_numbers_order_parent_idx" ON "payload"."_concepts_v_numbers" USING btree ("order","parent_id");
  CREATE INDEX "exams__status_idx" ON "payload"."exams" USING btree ("_status");
  CREATE INDEX "questions__status_idx" ON "payload"."questions" USING btree ("_status");
  CREATE INDEX "concepts__status_idx" ON "payload"."concepts" USING btree ("_status");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."_exams_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_questions_v_version_options" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_questions_v_version_options_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_questions_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_questions_v_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_questions_v_texts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_concepts_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_concepts_v_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."_concepts_v_numbers" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "payload"."_exams_v" CASCADE;
  DROP TABLE "payload"."_questions_v_version_options" CASCADE;
  DROP TABLE "payload"."_questions_v_version_options_locales" CASCADE;
  DROP TABLE "payload"."_questions_v" CASCADE;
  DROP TABLE "payload"."_questions_v_locales" CASCADE;
  DROP TABLE "payload"."_questions_v_texts" CASCADE;
  DROP TABLE "payload"."_concepts_v" CASCADE;
  DROP TABLE "payload"."_concepts_v_locales" CASCADE;
  DROP TABLE "payload"."_concepts_v_numbers" CASCADE;
  DROP INDEX "payload"."exams__status_idx";
  DROP INDEX "payload"."questions__status_idx";
  DROP INDEX "payload"."concepts__status_idx";
  ALTER TABLE "payload"."exams" ALTER COLUMN "provider" SET NOT NULL;
  ALTER TABLE "payload"."exams" ALTER COLUMN "slug" SET NOT NULL;
  ALTER TABLE "payload"."exams" ALTER COLUMN "provider_name" SET NOT NULL;
  ALTER TABLE "payload"."exams" ALTER COLUMN "code" SET NOT NULL;
  ALTER TABLE "payload"."exams" ALTER COLUMN "name" SET NOT NULL;
  ALTER TABLE "payload"."exams" ALTER COLUMN "language" SET NOT NULL;
  ALTER TABLE "payload"."questions_options" ALTER COLUMN "key" SET NOT NULL;
  ALTER TABLE "payload"."questions_options_locales" ALTER COLUMN "text" SET NOT NULL;
  ALTER TABLE "payload"."questions" ALTER COLUMN "exam_id" SET NOT NULL;
  ALTER TABLE "payload"."questions" ALTER COLUMN "qn" SET NOT NULL;
  ALTER TABLE "payload"."questions_locales" ALTER COLUMN "q" SET NOT NULL;
  ALTER TABLE "payload"."concepts" ALTER COLUMN "exam_id" SET NOT NULL;
  ALTER TABLE "payload"."concepts" ALTER COLUMN "svc" SET NOT NULL;
  ALTER TABLE "payload"."concepts" ALTER COLUMN "ord" SET NOT NULL;
  ALTER TABLE "payload"."concepts_locales" ALTER COLUMN "deff" SET NOT NULL;
  ALTER TABLE "payload"."exams" DROP COLUMN "_status";
  ALTER TABLE "payload"."questions" DROP COLUMN "_status";
  ALTER TABLE "payload"."concepts" DROP COLUMN "_status";
  DROP TYPE "payload"."enum_exams_status";
  DROP TYPE "payload"."enum__exams_v_version_language";
  DROP TYPE "payload"."enum__exams_v_version_status";
  DROP TYPE "payload"."enum__exams_v_published_locale";
  DROP TYPE "payload"."enum_questions_status";
  DROP TYPE "payload"."enum__questions_v_version_status";
  DROP TYPE "payload"."enum__questions_v_published_locale";
  DROP TYPE "payload"."enum_concepts_status";
  DROP TYPE "payload"."enum__concepts_v_version_status";
  DROP TYPE "payload"."enum__concepts_v_published_locale";`)
}
