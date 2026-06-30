import type { Annotation } from "./annotation";

// RemoteApi AnnotationStore (이슈 #29 / ADR-0005 D · 아키텍처 리뷰 C4). client → /api/annotations 의
// 얇은 fetch 어댑터 — progress 의 remoteApiProgressStore 대칭이다(그동안 progress 만 어댑터가 있고
// annotation 은 전송이 useAnnotationState 훅에 용접돼 있었다 — 미테스트 + basePath 무시 버그).
//
// exam_key·id 만 보낸다 — learner_id 는 Route Handler 가 세션에서 스코프하므로 client 가 타인 키를
// 만질 수 없다. 세션 쿠키(같은 오리진)는 credentials:"same-origin" 으로 동반된다. 실패는 throw 한다 —
// best-effort 정책(실패해도 학습 흐름을 막지 않음)은 호출부(useAnnotationState)가 swallow 로 소유한다.

export interface AnnotationApiOptions {
  /** 주입용(테스트). 기본 globalThis.fetch. */
  fetch?: typeof fetch;
  /** 서브경로 배포 대비. 기본 process.env.NEXT_PUBLIC_BASE_PATH(빌드 인라인). */
  basePath?: string;
}

export interface AnnotationStore {
  load(exam: string): Promise<Annotation[]>;
  upsert(exam: string, annotation: Annotation): Promise<void>;
  remove(id: string): Promise<void>;
}

export function remoteApiAnnotationStore(opts: AnnotationApiOptions = {}): AnnotationStore {
  const doFetch = opts.fetch ?? globalThis.fetch.bind(globalThis);
  const basePath = opts.basePath ?? process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const endpoint = `${basePath}/api/annotations`;

  return {
    async load(exam) {
      const res = await doFetch(`${endpoint}?exam=${encodeURIComponent(exam)}`, {
        method: "GET",
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error(`annotations load failed: ${res.status}`);
      const data = await res.json();
      return Array.isArray(data) ? (data as Annotation[]) : [];
    },

    async upsert(exam, annotation) {
      const res = await doFetch(endpoint, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ exam, annotation }),
      });
      if (!res.ok) throw new Error(`annotation upsert failed: ${res.status}`);
    },

    async remove(id) {
      const res = await doFetch(`${endpoint}?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error(`annotation delete failed: ${res.status}`);
    },
  };
}
