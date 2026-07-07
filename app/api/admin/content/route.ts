import { revalidatePath } from "next/cache";
import { pool } from "@/lib/db";
import { withAdmin, readJson, badRequest, noContent } from "@/lib/route-guards";
import { parseContentCommand } from "@/lib/content-command";
import { upsertQuestion, upsertConcept, deleteQuestion, deleteConcept } from "@/lib/content-db";

// 콘텐츠 변경 API (이슈 #27 / ADR-0005 B · 아키텍처 리뷰 C1). withAdmin 이 admin role 만 통과시킨다
// (미인증·비admin 균일 403 — 관리 표면 존재를 안 드러냄, progress 의 401 과 의도적 차이). 봉투 decode·
// 검증(정답 ⊂ options 등)은 parseContentCommand(순수·클라-safe)가 소유 — route 는 인가 + parse +
// dispatch 만 남는 선형 핸들러다(kind 로 op·entity 를 함께 좁혀 delete kind 가 PUT 에 오면 400).
// 저장/삭제 후 해당 Exam 경로를 revalidatePath 로 무효화해 ISR 캐시를 즉시 갱신(편집 즉시반영).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// trailingSlash:true 환경이라 라우트 경로의 슬래시 유무가 갈린다 — 양쪽을 무효화해
// ISR 캐시 silent miss 를 막는다(편집 즉시반영 보장).
function revalidateExam(examKey: string): void {
  revalidatePath(`/${examKey}`);
  revalidatePath(`/${examKey}/`);
}

export const PUT = withAdmin(async (req) => {
  const cmd = parseContentCommand(await readJson(req));
  if ("error" in cmd) throw badRequest(cmd.error);

  if (cmd.kind === "upsert-question") {
    await upsertQuestion(pool, cmd.examKey, cmd.question, cmd.lang);
  } else if (cmd.kind === "upsert-concept") {
    await upsertConcept(pool, cmd.examKey, cmd.concept, cmd.lang, cmd.ord);
  } else {
    throw badRequest("method/op mismatch"); // delete kind 가 PUT 으로 옴
  }

  revalidateExam(cmd.examKey);
  return noContent();
});

export const DELETE = withAdmin(async (req) => {
  const cmd = parseContentCommand(await readJson(req));
  if ("error" in cmd) throw badRequest(cmd.error);

  if (cmd.kind === "delete-question") {
    await deleteQuestion(pool, cmd.examKey, cmd.qn);
  } else if (cmd.kind === "delete-concept") {
    await deleteConcept(pool, cmd.examKey, cmd.svc);
  } else {
    throw badRequest("method/op mismatch"); // upsert kind 가 DELETE 로 옴
  }

  revalidateExam(cmd.examKey);
  return noContent();
});
