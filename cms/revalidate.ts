import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  Payload,
} from "payload";

// ISR on-demand revalidate 훅 (ADR-0024 결정 7). exam 레이아웃(revalidate=3600)이 콘텐츠를
// 소유하므로, questions/concepts/exams 변경 시 해당 시험 경로를 layout 스코프로 무효화해
// 편집이 즉시 반영되게 한다(구 /api/admin/content 의 revalidatePath 계승). 카탈로그 소비처
// (home·/me·컬렉션)는 force-dynamic 이라 훅이 필요 없다.
//
// next/cache 는 동적 import + try/catch — 이 훅은 CLI(payload run cms/migrate-content.ts)의
// 쓰기에서도 발화하는데, Next 요청 컨텍스트 밖에서는 revalidate 가 없는 게 정상이다(조용히 skip).

async function revalidateExam(paths: string[]): Promise<void> {
  try {
    const { revalidatePath } = await import("next/cache");
    for (const p of paths) revalidatePath(p, "layout");
  } catch {
    // Next 런타임 밖(CLI/스크립트) — revalidate 대상 캐시가 없다.
  }
}

/** 문서의 exam 관계(id 또는 populated)에서 시험 경로를 얻는다. */
async function examPath(payload: Payload, exam: unknown): Promise<string | null> {
  const id =
    typeof exam === "object" && exam !== null ? (exam as { id: number | string }).id : exam;
  if (id === null || id === undefined) return null;
  const doc = await payload.findByID({
    collection: "exams",
    id: id as number,
    depth: 0,
    overrideAccess: true,
  });
  return doc ? `/${doc.provider}/${doc.slug}` : null;
}

/** questions·concepts 공용 — 소속 시험 레이아웃 무효화. */
export const revalidateExamContent: CollectionAfterChangeHook = async ({ doc, req }) => {
  const p = await examPath(req.payload, (doc as { exam: unknown }).exam);
  if (p) await revalidateExam([p]);
  return doc;
};

export const revalidateExamContentOnDelete: CollectionAfterDeleteHook = async ({ doc, req }) => {
  const p = await examPath(req.payload, (doc as { exam: unknown }).exam);
  if (p) await revalidateExam([p]);
  return doc;
};

/** exams 자신 — meta·diagrams·q2svc·icons 가 레이아웃 데이터. slug 변경 시 새·구 경로 모두. */
export const revalidateExamDoc: CollectionAfterChangeHook = async ({ doc, previousDoc }) => {
  const d = doc as { provider: string; slug: string };
  const paths = [`/${d.provider}/${d.slug}`];
  const prev = previousDoc as { provider?: string; slug?: string } | undefined;
  if (prev?.provider && prev.slug && `${prev.provider}/${prev.slug}` !== `${d.provider}/${d.slug}`) {
    paths.push(`/${prev.provider}/${prev.slug}`);
  }
  await revalidateExam(paths);
  return doc;
};

export const revalidateExamDocOnDelete: CollectionAfterDeleteHook = async ({ doc }) => {
  const d = doc as { provider: string; slug: string };
  await revalidateExam([`/${d.provider}/${d.slug}`]);
  return doc;
};
