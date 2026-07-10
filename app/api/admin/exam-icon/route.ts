import { pool } from "@/lib/db";
import { withAdmin, readJson, badRequest, noContent } from "@/lib/route-guards";
import { listExams } from "@/lib/content";
import { parseIcon } from "@/lib/catalog";
import { upsertIconOverride, deleteIconOverride } from "@/lib/exam-icon-db";

// 문제집 아이콘 오버라이드 API (ADR-0023). withAdmin(admin/content 와 동일 — 미인증·비admin 균일
// 403). examKey 는 카탈로그(파일 meta)에 실존하는 시험만 — 임의 키로 행을 만들지 못하게 한다.
// 아이콘 소비 페이지(home·/me·컬렉션·admin)가 전부 force-dynamic 이라 revalidate 불요.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function knownExamKey(v: unknown): v is string {
  if (typeof v !== "string") return false;
  return listExams().some((e) => `${e.provider}/${e.slug}` === v);
}

export const PUT = withAdmin(async (req) => {
  const body = await readJson(req);
  if (!knownExamKey(body.examKey)) throw badRequest("unknown examKey");
  const icon = parseIcon(body.icon);
  if (!icon) throw badRequest("invalid icon"); // 빈 값 제거는 DELETE 가 소유
  await upsertIconOverride(pool, body.examKey, icon);
  return noContent();
});

export const DELETE = withAdmin(async (req) => {
  const body = await readJson(req);
  if (!knownExamKey(body.examKey)) throw badRequest("unknown examKey");
  await deleteIconOverride(pool, body.examKey);
  return noContent();
});
