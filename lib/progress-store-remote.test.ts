import { describe, it, expect, vi } from "vitest";
import { emptyProgress, recordResult } from "./progress";
import type { StoredProgress } from "./progress-store";
import { remoteApiProgressStore } from "./progress-store-remote";

const NOW = Date.parse("2026-06-23T10:00:00Z");
const SAVED_AT = Date.parse("2026-06-23T11:30:00Z");

function jsonRes(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    ...init,
  });
}

describe("remoteApiProgressStore — load", () => {
  it("GET /api/progress?exam=… 으로 봉투를 읽어온다", async () => {
    const snap = recordResult(emptyProgress(), 1, ["A"], true, NOW);
    const stored: StoredProgress = { snapshot: snap, updatedAt: SAVED_AT };
    const fetch = vi.fn().mockResolvedValue(jsonRes(stored));
    const store = remoteApiProgressStore({ fetch });

    const got = await store.load("aws/sap-c02");

    expect(got).toEqual(stored);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("/api/progress?exam=aws%2Fsap-c02");
    expect(init.method).toBe("GET");
    expect(init.credentials).toBe("same-origin"); // 세션 쿠키 동반
  });

  it("서버에 없으면(200 null 본문) null 을 낸다", async () => {
    const fetch = vi.fn().mockResolvedValue(jsonRes(null));
    const store = remoteApiProgressStore({ fetch });
    expect(await store.load("k")).toBeNull();
  });

  it("404 도 null 로 취급한다", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
    const store = remoteApiProgressStore({ fetch });
    expect(await store.load("k")).toBeNull();
  });

  it("미인증(401) 등 실패는 throw 한다 (composite가 offline 으로 취급)", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
    const store = remoteApiProgressStore({ fetch });
    await expect(store.load("k")).rejects.toThrow();
  });

  it("basePath 를 경로에 반영한다", async () => {
    const fetch = vi.fn().mockResolvedValue(jsonRes(null));
    const store = remoteApiProgressStore({ fetch, basePath: "/quizdeck" });
    await store.load("k");
    expect(fetch.mock.calls[0][0]).toBe("/quizdeck/api/progress?exam=k");
  });
});

describe("remoteApiProgressStore — save", () => {
  it("PUT /api/progress 로 {exam, snapshot, updatedAt} 를 보낸다", async () => {
    const snap = recordResult(emptyProgress(), 2, ["B"], false, NOW);
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    const store = remoteApiProgressStore({ fetch });

    await store.save("aws/sap-c02", snap, SAVED_AT);

    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("/api/progress");
    expect(init.method).toBe("PUT");
    expect(init.credentials).toBe("same-origin");
    expect(init.headers["content-type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({
      exam: "aws/sap-c02",
      snapshot: snap,
      updatedAt: SAVED_AT,
    });
  });

  it("실패 응답은 throw 한다", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 500 }));
    const store = remoteApiProgressStore({ fetch });
    await expect(store.save("k", emptyProgress(), SAVED_AT)).rejects.toThrow();
  });
});
