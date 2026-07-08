import { describe, it, expect, vi, afterEach } from "vitest";
import { log } from "./log";

afterEach(() => vi.restoreAllMocks());

describe("log", () => {
  it("한 줄 JSON 으로 level·msg·fields·time 을 낸다", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    log.warn("hello", { a: 1, b: "x" });
    expect(spy).toHaveBeenCalledOnce();
    const obj = JSON.parse(spy.mock.calls[0][0] as string);
    expect(obj).toMatchObject({ level: "warn", msg: "hello", a: 1, b: "x" });
    expect(typeof obj.time).toBe("string");
  });

  it("error 는 console.error 로 가고 Error 필드를 name/message/stack 으로 편다(빈 {} 아님)", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    log.error("boom", { err: new Error("nope") });
    const obj = JSON.parse(spy.mock.calls[0][0] as string);
    expect(obj.level).toBe("error");
    expect(obj.err.message).toBe("nope");
    expect(obj.err.name).toBe("Error");
    expect(typeof obj.err.stack).toBe("string");
  });

  it("구조 키(level/msg/time)는 fields 로 덮이지 않는다", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    log.warn("real", { level: "HACK", msg: "HACK", time: "HACK" });
    const obj = JSON.parse(spy.mock.calls[0][0] as string);
    expect(obj.level).toBe("warn");
    expect(obj.msg).toBe("real");
    expect(obj.time).not.toBe("HACK");
  });
});
