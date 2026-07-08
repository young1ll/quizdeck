import { Pool } from "pg";

// health/status 모듈 (ADR-0018). liveness·readiness 는 DB 무관이고, /api/status 만 checkDb 로 data
// tier(클러스터 밖 postgres VM) 도달성을 진단한다. 전용 pool 이 connect·query 를 pg 레벨에서 바운드해
// (hang·누수 없이) 공유 lib/db pool 을 건드리지 않는다. checkDb·getStatus 는 어댑터를 파라미터로 받아
// 실DB 없이 단위 테스트된다(ADR-0001 adapter-as-param 관례).

// 최소 쿼리 인터페이스 — prod=pg Pool, test=in-memory fake 두 어댑터로 seam 이 real.
export type Queryable = { query(sql: string): Promise<unknown> };

export type DbStatus = { status: "up" | "down"; latencyMs: number };

// 배포 sha — Dockerfile runtime 스테이지의 ENV BUILD_SHA(= CI 가 --build-arg 로 주입한 이미지 태그).
// 미주입(로컬 dev·구 이미지)이면 'unknown'. 공개 노출 안전 — 이미지 태그·git 이 이미 공개다.
export function getVersion(): { sha: string } {
  return { sha: process.env.BUILD_SHA ?? "unknown" };
}

// 전용 health pool — connect·query 를 pg 레벨에서 바운드(누수·hang 없음), 공유 pool 무변경. Pool 생성만으론
// 접속하지 않고 첫 쿼리에서 연결하므로 import 는 항상 안전(빌드 시점 env 부재도 무해).
export const healthPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  connectionTimeoutMillis: 2000,
  statement_timeout: 2000,
});

// data tier 도달성 프로브 — select 1 성공=up, 실패=down. **절대 throw 안 함**: /api/status 는 db 가
// down 이어도 200 으로 진단을 돌려줘야 한다. 시간 바운드는 주입된 pool 설정(connectionTimeoutMillis·
// statement_timeout)이 소유하므로 여기선 Promise.race 가 불필요하다.
export async function checkDb(q: Queryable): Promise<DbStatus> {
  const t0 = performance.now();
  try {
    await q.query("select 1");
    return { status: "up", latencyMs: Math.round(performance.now() - t0) };
  } catch {
    return { status: "down", latencyMs: Math.round(performance.now() - t0) };
  }
}

// /api/status 진단 페이로드. 시크릿·접속정보(DATABASE_URL·호스트/포트)·stack 은 절대 안 담는다(ADR-0018).
export type Status = {
  sha: string;
  db: DbStatus;
  uptimeSec: number;
  startedAt: string;
  now: string;
};

export async function getStatus(q: Queryable = healthPool): Promise<Status> {
  const db = await checkDb(q);
  const uptimeSec = Math.round(process.uptime());
  const now = new Date();
  const startedAt = new Date(now.getTime() - uptimeSec * 1000);
  return {
    sha: getVersion().sha,
    db,
    uptimeSec,
    startedAt: startedAt.toISOString(),
    now: now.toISOString(),
  };
}
