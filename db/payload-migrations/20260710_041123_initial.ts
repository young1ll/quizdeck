import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // payload 스키마는 이 첫 마이그레이션이 소유한다 — 새(로컬 임시) DB 에도 psql 선행작업 없이
  // `pnpm payload migrate` 하나로 적용되게. (generator 는 CREATE SCHEMA 를 만들어주지 않는다)
  await db.execute(sql`
   CREATE SCHEMA IF NOT EXISTS "payload";
   CREATE TYPE "payload"."_locales" AS ENUM('ko', 'en');
  CREATE TYPE "payload"."enum_cms_users_role" AS ENUM('admin', 'author');
  CREATE TYPE "payload"."enum_exams_language" AS ENUM('ko', 'en');
  CREATE TABLE "payload"."cms_users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"auth_user_id" varchar NOT NULL,
  	"email" varchar NOT NULL,
  	"name" varchar,
  	"role" "payload"."enum_cms_users_role" DEFAULT 'author' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."exams" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"provider" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"exam_key" varchar,
  	"provider_name" varchar NOT NULL,
  	"code" varchar NOT NULL,
  	"name" varchar NOT NULL,
  	"language" "payload"."enum_exams_language" DEFAULT 'ko' NOT NULL,
  	"icon" varchar,
  	"icon_image_id" integer,
  	"track_id" varchar,
  	"track_name" varchar,
  	"diagrams" jsonb,
  	"q2svc" jsonb,
  	"svc_icons" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."questions_options" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL
  );
  
  CREATE TABLE "payload"."questions_options_locales" (
  	"text" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "payload"."_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "payload"."questions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"exam_id" integer NOT NULL,
  	"qn" numeric NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."questions_locales" (
  	"topic" varchar,
  	"q" varchar NOT NULL,
  	"explanation" varchar,
  	"tip" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "payload"."_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "payload"."questions_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "payload"."concepts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"exam_id" integer NOT NULL,
  	"svc" varchar NOT NULL,
  	"ord" numeric NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."concepts_locales" (
  	"cat" varchar,
  	"abbr" varchar,
  	"deff" varchar NOT NULL,
  	"key" varchar,
  	"when" varchar,
  	"trap" varchar,
  	"vs" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "payload"."_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "payload"."media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric
  );
  
  CREATE TABLE "payload"."payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload"."payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"cms_users_id" integer,
  	"exams_id" integer,
  	"questions_id" integer,
  	"concepts_id" integer,
  	"media_id" integer
  );
  
  CREATE TABLE "payload"."payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"cms_users_id" integer
  );
  
  CREATE TABLE "payload"."payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload"."exams" ADD CONSTRAINT "exams_icon_image_id_media_id_fk" FOREIGN KEY ("icon_image_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."questions_options" ADD CONSTRAINT "questions_options_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."questions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."questions_options_locales" ADD CONSTRAINT "questions_options_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."questions_options"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."questions" ADD CONSTRAINT "questions_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "payload"."exams"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."questions_locales" ADD CONSTRAINT "questions_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."questions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."questions_texts" ADD CONSTRAINT "questions_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."questions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."concepts" ADD CONSTRAINT "concepts_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "payload"."exams"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."concepts_locales" ADD CONSTRAINT "concepts_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."concepts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_cms_users_fk" FOREIGN KEY ("cms_users_id") REFERENCES "payload"."cms_users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_exams_fk" FOREIGN KEY ("exams_id") REFERENCES "payload"."exams"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_questions_fk" FOREIGN KEY ("questions_id") REFERENCES "payload"."questions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_concepts_fk" FOREIGN KEY ("concepts_id") REFERENCES "payload"."concepts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "payload"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_cms_users_fk" FOREIGN KEY ("cms_users_id") REFERENCES "payload"."cms_users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "cms_users_auth_user_id_idx" ON "payload"."cms_users" USING btree ("auth_user_id");
  CREATE INDEX "cms_users_updated_at_idx" ON "payload"."cms_users" USING btree ("updated_at");
  CREATE INDEX "cms_users_created_at_idx" ON "payload"."cms_users" USING btree ("created_at");
  CREATE UNIQUE INDEX "exams_exam_key_idx" ON "payload"."exams" USING btree ("exam_key");
  CREATE INDEX "exams_icon_image_idx" ON "payload"."exams" USING btree ("icon_image_id");
  CREATE INDEX "exams_updated_at_idx" ON "payload"."exams" USING btree ("updated_at");
  CREATE INDEX "exams_created_at_idx" ON "payload"."exams" USING btree ("created_at");
  CREATE INDEX "questions_options_order_idx" ON "payload"."questions_options" USING btree ("_order");
  CREATE INDEX "questions_options_parent_id_idx" ON "payload"."questions_options" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "questions_options_locales_locale_parent_id_unique" ON "payload"."questions_options_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "questions_exam_idx" ON "payload"."questions" USING btree ("exam_id");
  CREATE INDEX "questions_updated_at_idx" ON "payload"."questions" USING btree ("updated_at");
  CREATE INDEX "questions_created_at_idx" ON "payload"."questions" USING btree ("created_at");
  CREATE UNIQUE INDEX "questions_locales_locale_parent_id_unique" ON "payload"."questions_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "questions_texts_order_parent" ON "payload"."questions_texts" USING btree ("order","parent_id");
  CREATE INDEX "concepts_exam_idx" ON "payload"."concepts" USING btree ("exam_id");
  CREATE INDEX "concepts_svc_idx" ON "payload"."concepts" USING btree ("svc");
  CREATE INDEX "concepts_updated_at_idx" ON "payload"."concepts" USING btree ("updated_at");
  CREATE INDEX "concepts_created_at_idx" ON "payload"."concepts" USING btree ("created_at");
  CREATE UNIQUE INDEX "concepts_locales_locale_parent_id_unique" ON "payload"."concepts_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "media_updated_at_idx" ON "payload"."media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "payload"."media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "payload"."media" USING btree ("filename");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload"."payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload"."payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload"."payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload"."payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload"."payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload"."payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload"."payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_cms_users_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_users_id");
  CREATE INDEX "payload_locked_documents_rels_exams_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("exams_id");
  CREATE INDEX "payload_locked_documents_rels_questions_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("questions_id");
  CREATE INDEX "payload_locked_documents_rels_concepts_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("concepts_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload"."payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload"."payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload"."payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload"."payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload"."payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload"."payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_cms_users_id_idx" ON "payload"."payload_preferences_rels" USING btree ("cms_users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload"."payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload"."payload_migrations" USING btree ("created_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "payload"."cms_users" CASCADE;
  DROP TABLE "payload"."exams" CASCADE;
  DROP TABLE "payload"."questions_options" CASCADE;
  DROP TABLE "payload"."questions_options_locales" CASCADE;
  DROP TABLE "payload"."questions" CASCADE;
  DROP TABLE "payload"."questions_locales" CASCADE;
  DROP TABLE "payload"."questions_texts" CASCADE;
  DROP TABLE "payload"."concepts" CASCADE;
  DROP TABLE "payload"."concepts_locales" CASCADE;
  DROP TABLE "payload"."media" CASCADE;
  DROP TABLE "payload"."payload_kv" CASCADE;
  DROP TABLE "payload"."payload_locked_documents" CASCADE;
  DROP TABLE "payload"."payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload"."payload_preferences" CASCADE;
  DROP TABLE "payload"."payload_preferences_rels" CASCADE;
  DROP TABLE "payload"."payload_migrations" CASCADE;
  DROP TYPE "payload"."_locales";
  DROP TYPE "payload"."enum_cms_users_role";
  DROP TYPE "payload"."enum_exams_language";`)
}
