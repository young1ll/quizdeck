import type { Endpoint, PayloadRequest } from "payload";

// 구 JSON 포맷 반입 엔드포인트 (ADR-0024 2차 확장 C① — 합의: 원자적 거부). POST /api/cms/import-json
// body: { examId, kind: "questions"|"concepts", items: 구 questions/concepts.json 배열 }
// 인증: cms 세션(auth-strategy 가 req.user 를 채움 — admin|author). 검증을 **전부 먼저** 수행해
// 하나라도 실패면 아무것도 만들지 않고 에러 목록을 돌려준다(0 또는 전부). 성공 시 전부 **초안**으로
// 생성 — 게시는 목록/편집에서 검토 후(드래프트 워크플로). 생성 중 예기치 못한 실패는 만들어진
// 초안을 역삭제(best-effort 롤백)한다.

interface RawQuestion {
  qn?: unknown;
  topic?: unknown;
  q?: unknown;
  options?: unknown;
  answer?: unknown;
  explanation?: unknown;
  tip?: unknown;
  page?: unknown;
  deeplink?: unknown;
}
interface RawConcept {
  svc?: unknown;
  cat?: unknown;
  abbr?: unknown;
  deff?: unknown;
  key?: unknown;
  when?: unknown;
  trap?: unknown;
  vs?: unknown;
  detail?: unknown;
  cost?: unknown;
  rel?: unknown;
  reln?: unknown;
}
interface ImportError {
  index: number;
  id: string;
  message: string;
}

const str = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

function validateQuestions(items: RawQuestion[], existingQn: Set<number>): ImportError[] {
  const errors: ImportError[] = [];
  const seen = new Set<number>();
  items.forEach((it, index) => {
    const id = `qn=${String(it.qn ?? "?")}`;
    const qn = typeof it.qn === "number" && Number.isInteger(it.qn) && it.qn >= 1 ? it.qn : null;
    if (qn === null) return errors.push({ index, id, message: "qn 은 1 이상의 정수여야 합니다" }) && undefined;
    if (seen.has(qn)) errors.push({ index, id, message: "파일 안에서 qn 이 중복됩니다" });
    if (existingQn.has(qn)) errors.push({ index, id, message: "대상 문제집에 이미 있는 qn 입니다(초안 포함)" });
    seen.add(qn);
    if (!str(it.q)) errors.push({ index, id, message: "q(지문)가 비었습니다" });
    const opts = it.options;
    const keys =
      opts && typeof opts === "object" && !Array.isArray(opts)
        ? Object.keys(opts as Record<string, unknown>)
        : [];
    if (keys.length < 2) errors.push({ index, id, message: "options 는 2개 이상이어야 합니다" });
    for (const k of keys)
      if (!str((opts as Record<string, unknown>)[k]))
        errors.push({ index, id, message: `options.${k} 텍스트가 비었습니다` });
    const ans = Array.isArray(it.answer) ? (it.answer as unknown[]) : null;
    if (!ans || !ans.length || !ans.every((a) => typeof a === "string"))
      errors.push({ index, id, message: "answer 는 비어있지 않은 문자열 배열이어야 합니다" });
    else for (const a of ans) if (!keys.includes(a)) errors.push({ index, id, message: `정답 ${a} 가 보기에 없습니다` });
  });
  return errors;
}

function validateConcepts(items: RawConcept[], existingSvc: Set<string>): ImportError[] {
  const errors: ImportError[] = [];
  const seen = new Set<string>();
  items.forEach((it, index) => {
    const id = `svc=${String(it.svc ?? "?").slice(0, 30)}`;
    if (!str(it.svc)) return errors.push({ index, id, message: "svc 가 비었습니다" }) && undefined;
    const svc = (it.svc as string).trim();
    if (seen.has(svc)) errors.push({ index, id, message: "파일 안에서 svc 가 중복됩니다" });
    if (existingSvc.has(svc)) errors.push({ index, id, message: "대상 문제집에 이미 있는 svc 입니다(초안 포함)" });
    seen.add(svc);
    if (!str(it.deff)) errors.push({ index, id, message: "deff(정의)가 비었습니다" });
    if (it.rel !== undefined && (!Array.isArray(it.rel) || !(it.rel as unknown[]).every((n) => typeof n === "number")))
      errors.push({ index, id, message: "rel 은 숫자 배열이어야 합니다" });
  });
  return errors;
}

export const importJsonEndpoint: Endpoint = {
  path: "/import-json",
  method: "post",
  handler: async (req: PayloadRequest) => {
    if (!req.user) return Response.json({ error: "인증 필요" }, { status: 401 });
    const body = (await req.json?.()) as
      | { examId?: number; kind?: string; items?: unknown[] }
      | undefined;
    const examId = body?.examId;
    const kind = body?.kind;
    const items = body?.items;
    if (!examId || (kind !== "questions" && kind !== "concepts") || !Array.isArray(items) || !items.length)
      return Response.json({ error: "examId·kind(questions|concepts)·items 가 필요합니다" }, { status: 400 });
    if (items.length > 2000)
      return Response.json({ error: "한 번에 2000개까지 반입할 수 있습니다" }, { status: 400 });

    const payload = req.payload;
    const exam = await payload
      .findByID({ collection: "exams", id: examId, depth: 0, draft: true, overrideAccess: true })
      .catch(() => null);
    if (!exam) return Response.json({ error: "대상 문제집이 없습니다" }, { status: 400 });

    // ── 1) 원자적 사전 검증 — 실패가 하나라도 있으면 아무것도 만들지 않는다 ──
    let errors: ImportError[];
    if (kind === "questions") {
      const existing = await payload.find({
        collection: "questions",
        where: { exam: { equals: examId } },
        // 본 테이블 조회(draft 미지정) — draft 전용 문서 포함 전수(훅과 같은 규칙)
        pagination: false,
        depth: 0,
        overrideAccess: true,
      });
      errors = validateQuestions(items as RawQuestion[], new Set(existing.docs.map((d) => d.qn)));
    } else {
      const existing = await payload.find({
        collection: "concepts",
        where: { exam: { equals: examId } },
        // 본 테이블 조회(draft 미지정) — draft 전용 문서 포함 전수(훅과 같은 규칙)
        pagination: false,
        depth: 0,
        overrideAccess: true,
      });
      errors = validateConcepts(items as RawConcept[], new Set(existing.docs.map((d) => d.svc)));
    }
    if (errors.length)
      return Response.json({ error: "검증 실패 — 아무것도 반입되지 않았습니다", errors }, { status: 400 });

    // ── 2) 전부 초안 생성 (실패 시 best-effort 역삭제) ──
    const created: number[] = [];
    try {
      if (kind === "questions") {
        for (const raw of items as RawQuestion[]) {
          const doc = await payload.create({
            collection: "questions",
            draft: true,
            depth: 0,
            locale: "ko",
            overrideAccess: true,
            data: {
              exam: examId,
              qn: raw.qn as number,
              topic: (raw.topic as string) ?? null,
              q: raw.q as string,
              options: Object.entries(raw.options as Record<string, string>).map(([key, text]) => ({ key, text })),
              answer: raw.answer as string[],
              explanation: (raw.explanation as string) ?? null,
              tip: (raw.tip as string) ?? null,
              page: typeof raw.page === "number" ? raw.page : null,
              deeplink: (raw.deeplink as string) ?? null,
            },
          });
          created.push(doc.id);
        }
      } else {
        const maxOrd = await payload.find({
          collection: "concepts",
          where: { exam: { equals: examId } },
          sort: "-ord",
          limit: 1,
          depth: 0,
          overrideAccess: true,
        });
        let ord = (maxOrd.docs[0]?.ord ?? -1) + 1;
        for (const raw of items as RawConcept[]) {
          const doc = await payload.create({
            collection: "concepts",
            draft: true,
            depth: 0,
            locale: "ko",
            overrideAccess: true,
            data: {
              exam: examId,
              svc: (raw.svc as string).trim(),
              ord: ord++,
              cat: (raw.cat as string) ?? null,
              abbr: (raw.abbr as string) ?? null,
              deff: raw.deff as string,
              key: (raw.key as string) ?? null,
              when: (raw.when as string) ?? null,
              trap: (raw.trap as string) ?? null,
              vs: (raw.vs as string) ?? null,
              detail: (raw.detail as string) ?? null,
              cost: (raw.cost as string) ?? null,
              rel: (raw.rel as number[]) ?? null,
              reln: typeof raw.reln === "number" ? raw.reln : null,
            },
          });
          created.push(doc.id);
        }
      }
    } catch (e) {
      for (const id of created.reverse())
        await payload.delete({ collection: kind, id, overrideAccess: true }).catch(() => undefined);
      return Response.json(
        { error: `생성 중 오류 — 롤백됨(${created.length}건 삭제): ${e instanceof Error ? e.message : e}` },
        { status: 500 },
      );
    }
    return Response.json({ created: created.length, kind, examKey: exam.examKey });
  },
};
