import { describe, it, expect } from "vitest";
import { localAnnotationCache, inMemoryAnnotationCache } from "./annotation-store-local";
import type { Annotation } from "./annotation";

// 로컬 주석 캐시 (아키텍처 리뷰 annotation-sync / ADR-0016). write-through 미러 — 새로고침·오프라인
// 생존을 위한 (Learner, Exam) 스코프 캐시. 순수 계약이라 fake Storage 로 단위테스트한다.

const anchor = { quote: "q", prefix: "", suffix: "" };
const ann = (id: string): Annotation => ({
  id, qn: 1, lang: "ko", field: "q", kind: "highlight", anchor,
});

function fakeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
    key: (i) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  };
}

describe("localAnnotationCache", () => {
  it("없으면 빈 배열, write 후 read 로 왕복한다", () => {
    const cache = localAnnotationCache(fakeStorage());
    expect(cache.read("learner-1", "aws/x")).toEqual([]);
    cache.write("learner-1", "aws/x", [ann("a"), ann("b")]);
    expect(cache.read("learner-1", "aws/x").map((a) => a.id)).toEqual(["a", "b"]);
  });

  it("키가 (Learner, Exam)별로 격리된다 — 다른 Learner·Exam 은 안 보인다", () => {
    const storage = fakeStorage();
    const cache = localAnnotationCache(storage);
    cache.write("learner-1", "aws/x", [ann("a")]);
    expect(cache.read("learner-2", "aws/x")).toEqual([]); // 다른 Learner
    expect(cache.read("learner-1", "aws/y")).toEqual([]); // 다른 Exam
  });

  it("깨진 JSON 이면 빈 배열(throw 하지 않음)", () => {
    const storage = fakeStorage();
    storage.setItem("quizdeck:annotations:learner-1::aws/x", "{ not json");
    expect(localAnnotationCache(storage).read("learner-1", "aws/x")).toEqual([]);
  });

  it("배열이 아닌 값이 들어있어도 빈 배열", () => {
    const storage = fakeStorage();
    storage.setItem("quizdeck:annotations:learner-1::aws/x", JSON.stringify({ a: 1 }));
    expect(localAnnotationCache(storage).read("learner-1", "aws/x")).toEqual([]);
  });

  it("Storage 없으면(SSR·차단) read=[]·write=no-op 로 조용히 동작", () => {
    // storage 미주입 + window 없음(node 환경) → get() 이 null
    const cache = localAnnotationCache();
    expect(cache.read("learner-1", "aws/x")).toEqual([]);
    expect(() => cache.write("learner-1", "aws/x", [ann("a")])).not.toThrow();
  });
});

describe("inMemoryAnnotationCache", () => {
  it("write/read 왕복 + (Learner, Exam) 격리", () => {
    const cache = inMemoryAnnotationCache();
    cache.write("l1", "e1", [ann("a")]);
    expect(cache.read("l1", "e1").map((a) => a.id)).toEqual(["a"]);
    expect(cache.read("l2", "e1")).toEqual([]);
    expect(cache.read("l1", "e2")).toEqual([]);
  });
});
