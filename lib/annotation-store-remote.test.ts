import { describe, it, expect, vi } from "vitest";
import { remoteApiAnnotationStore } from "./annotation-store-remote";
import type { Annotation } from "./annotation";

// RemoteApi AnnotationStore 어댑터 테스트 (리뷰 C4). 그동안 전송이 훅에 용접돼 미테스트였다.
// fetch 주입으로 URL(특히 basePath)·method·body·throw 를 검증한다 — basePath 무시 버그(서브경로
// 배포 시 annotation 깨짐)를 못 박는 회귀 가드.

const ann: Annotation = {
  id: "a1", qn: 1, lang: "ko", field: "q", kind: "highlight",
  anchor: { quote: "x", prefix: "", suffix: "" },
};

const okJson = (body: unknown) =>
  ({ ok: true, status: 200, json: async () => body }) as unknown as Response;

describe("remoteApiAnnotationStore", () => {
  it("load 는 basePath 를 붙인 GET 으로 목록을 가져온다", async () => {
    const fetch = vi.fn(async () => okJson([ann]));
    const res = await remoteApiAnnotationStore({ fetch, basePath: "/sub" }).load("aws/x");
    expect(fetch).toHaveBeenCalledWith(
      "/sub/api/annotations?exam=aws%2Fx",
      expect.objectContaining({ method: "GET", credentials: "same-origin" }),
    );
    expect(res).toEqual([ann]);
  });

  it("basePath 기본은 빈 문자열(루트 배포) — /api/annotations", async () => {
    const fetch = vi.fn(async () => okJson([]));
    await remoteApiAnnotationStore({ fetch }).load("aws/x");
    expect(fetch).toHaveBeenCalledWith("/api/annotations?exam=aws%2Fx", expect.anything());
  });

  it("upsert 는 {exam, annotation} 을 PUT 한다(basePath 포함)", async () => {
    const fetch = vi.fn(async () => okJson(null));
    await remoteApiAnnotationStore({ fetch, basePath: "/sub" }).upsert("aws/x", ann);
    expect(fetch).toHaveBeenCalledWith(
      "/sub/api/annotations",
      expect.objectContaining({
        method: "PUT",
        credentials: "same-origin",
        body: JSON.stringify({ exam: "aws/x", annotation: ann }),
      }),
    );
  });

  it("remove 는 id 로 DELETE 한다(basePath 포함)", async () => {
    const fetch = vi.fn(async () => okJson(null));
    await remoteApiAnnotationStore({ fetch, basePath: "/sub" }).remove("a1");
    expect(fetch).toHaveBeenCalledWith(
      "/sub/api/annotations?id=a1",
      expect.objectContaining({ method: "DELETE", credentials: "same-origin" }),
    );
  });

  it("!ok 응답은 throw 한다(호출부가 best-effort swallow)", async () => {
    const fetch = vi.fn(async () => ({ ok: false, status: 500 }) as Response);
    const store = remoteApiAnnotationStore({ fetch });
    await expect(store.load("aws/x")).rejects.toThrow();
    await expect(store.upsert("aws/x", ann)).rejects.toThrow();
    await expect(store.remove("a1")).rejects.toThrow();
  });
});
