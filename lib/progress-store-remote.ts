import type { Progress } from "./progress";
import type { ProgressStore, StoredProgress } from "./progress-store";

// RemoteApi ProgressStore (이슈 #7 / ADR-0003).
//
// client → /api/progress 의 얇은 fetch 어댑터. exam_key 만 보낸다 — learner_id 는
// Route Handler 가 세션에서 해석해 스코프하므로 client 가 타인 키를 만질 수 없다.
// 세션 쿠키(같은 오리진)는 credentials:"same-origin" 으로 동반된다.
//
// 실패(미인증·네트워크)는 throw 한다 — compositeProgressStore 가 이를 잡아 offline 으로
// 취급하고 local 로 진행한다. 즉, 동기화 실패는 학습 흐름을 막지 않는다.

export interface RemoteApiOptions {
  /** 주입용(테스트). 기본 globalThis.fetch. */
  fetch?: typeof fetch;
  /** 서브경로 배포 대비. 기본 process.env.NEXT_PUBLIC_BASE_PATH(빌드 인라인). */
  basePath?: string;
}

export function remoteApiProgressStore(opts: RemoteApiOptions = {}): ProgressStore {
  const doFetch = opts.fetch ?? globalThis.fetch.bind(globalThis);
  const basePath = opts.basePath ?? process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const endpoint = `${basePath}/api/progress`;

  return {
    async load(key) {
      const res = await doFetch(`${endpoint}?exam=${encodeURIComponent(key)}`, {
        method: "GET",
        credentials: "same-origin",
      });
      if (res.status === 404) return null; // 아직 서버에 없음
      if (!res.ok) throw new Error(`progress load failed: ${res.status}`);
      const text = await res.text();
      if (!text) return null;
      return JSON.parse(text) as StoredProgress;
    },

    async save(key, snapshot: Progress, updatedAt) {
      const res = await doFetch(endpoint, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ exam: key, snapshot, updatedAt }),
      });
      if (!res.ok) throw new Error(`progress save failed: ${res.status}`);
    },
  };
}
