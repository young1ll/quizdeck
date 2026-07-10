import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."questions" ADD COLUMN "image_id" integer;
  ALTER TABLE "payload"."_questions_v" ADD COLUMN "version_image_id" integer;
  ALTER TABLE "payload"."questions" ADD CONSTRAINT "questions_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_questions_v" ADD CONSTRAINT "_questions_v_version_image_id_media_id_fk" FOREIGN KEY ("version_image_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "questions_image_idx" ON "payload"."questions" USING btree ("image_id");
  CREATE INDEX "_questions_v_version_version_image_idx" ON "payload"."_questions_v" USING btree ("version_image_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."questions" DROP CONSTRAINT "questions_image_id_media_id_fk";
  
  ALTER TABLE "payload"."_questions_v" DROP CONSTRAINT "_questions_v_version_image_id_media_id_fk";
  
  DROP INDEX "payload"."questions_image_idx";
  DROP INDEX "payload"."_questions_v_version_version_image_idx";
  ALTER TABLE "payload"."questions" DROP COLUMN "image_id";
  ALTER TABLE "payload"."_questions_v" DROP COLUMN "version_image_id";`)
}
