import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "payload"."concepts_numbers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"number" numeric,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL
  );
  
  ALTER TABLE "payload"."questions" ADD COLUMN "page" numeric;
  ALTER TABLE "payload"."questions" ADD COLUMN "deeplink" varchar;
  ALTER TABLE "payload"."concepts" ADD COLUMN "reln" numeric;
  ALTER TABLE "payload"."concepts_locales" ADD COLUMN "detail" varchar;
  ALTER TABLE "payload"."concepts_locales" ADD COLUMN "cost" varchar;
  ALTER TABLE "payload"."concepts_numbers" ADD CONSTRAINT "concepts_numbers_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."concepts"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "concepts_numbers_order_parent_idx" ON "payload"."concepts_numbers" USING btree ("order","parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "payload"."concepts_numbers" CASCADE;
  ALTER TABLE "payload"."questions" DROP COLUMN "page";
  ALTER TABLE "payload"."questions" DROP COLUMN "deeplink";
  ALTER TABLE "payload"."concepts" DROP COLUMN "reln";
  ALTER TABLE "payload"."concepts_locales" DROP COLUMN "detail";
  ALTER TABLE "payload"."concepts_locales" DROP COLUMN "cost";`)
}
