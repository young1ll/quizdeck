// 구조화 로깅 (아키텍처 리뷰 후보 B). 한 줄 JSON 을 stdout/stderr 로 낸다 — 지금은 pod 로그
// (kubectl logs)로 보이고, Cloudflare Logpush/Loki 같은 수집이 켜지면 호출부 변경 없이 그대로
// 쿼리된다. **어댑터 교체 seam 은 두지 않는다**: 두 번째 수집처가 실재할 때까지는 가설 seam 이다
// (ADR-0001 '가설 seam 회피'). 실 소비자는 지금 침묵하는 API 예외(route-guards)와 startup/dev 경고.
type Fields = Record<string, unknown>;
type Level = "error" | "warn" | "info";

// Error 는 열거 불가 속성이라 JSON.stringify 하면 {} 가 된다 — name/message/stack 을 드러낸다.
function normalize(fields?: Fields): Fields {
  const out: Fields = {};
  for (const [k, v] of Object.entries(fields ?? {})) {
    out[k] = v instanceof Error ? { name: v.name, message: v.message, stack: v.stack } : v;
  }
  return out;
}

function emit(level: Level, msg: string, fields?: Fields): void {
  // 구조 키(level·msg·time)를 마지막에 둬 fields 가 덮지 못하게 한다.
  const line = JSON.stringify({ ...normalize(fields), level, msg, time: new Date().toISOString() });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  error: (msg: string, fields?: Fields) => emit("error", msg, fields),
  warn: (msg: string, fields?: Fields) => emit("warn", msg, fields),
  info: (msg: string, fields?: Fields) => emit("info", msg, fields),
};
