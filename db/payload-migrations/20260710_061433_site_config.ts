import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "payload"."enum_site_config_notice_tone" AS ENUM('info', 'warning');
  CREATE TABLE "payload"."site_config" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tagline" varchar,
  	"footer_text" varchar,
  	"notice_enabled" boolean DEFAULT false,
  	"notice_text" varchar,
  	"notice_tone" "payload"."enum_site_config_notice_tone" DEFAULT 'info',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "payload"."site_config" CASCADE;
  DROP TYPE "payload"."enum_site_config_notice_tone";`)
}
