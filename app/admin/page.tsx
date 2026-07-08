import Link from "next/link";
import { LuExternalLink } from "react-icons/lu";
import { Card } from "@/components/ui/Card";
import { requireAdminPage } from "@/lib/route-guards";
import { getStatus } from "@/lib/health";

// uptimeSec → "1d 2h 3m"(0 단위 생략, <60s 는 "0m"). 인앱 status 카드 표기용.
function fmtUptime(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return [d && `${d}d`, h && `${h}h`, `${m}m`].filter(Boolean).join(" ");
}

// 어드민 허브 (아키텍처 리뷰 admin-hub / ADR-0017). admin 운영 표면의 랜딩 — 영역(콘텐츠·사용자)
// 진입 + 인프라 바로가기. admin role 아니면 notFound. 세션 의존이라 동적, node 런타임.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 인프라 링크 — admin 전용(requireAdminPage 뒤)이라 노출 안전(단순 하이퍼링크, 시크릿 없음). 대상
// 쪽 자체 인증. 새 탭으로 연다. dash=사용자 관리 위임처(ADR-0017).
const INFRA: { label: string; desc: string; href: string }[] = [
  {
    label: "Better Auth 대시보드",
    desc: "사용자·세션·이벤트·ban 관리",
    href: "https://dash.better-auth.com",
  },
  {
    label: "GitHub 저장소 · Actions",
    desc: "소스·CI·배포(GitOps)·PR",
    href: "https://github.com/young1ll/quizdeck",
  },
  { label: "Resend 이메일", desc: "인증·재설정 메일 전송 로그", href: "https://resend.com/emails" },
  { label: "Health · 상태", desc: "라이브 상태 확인", href: "https://myquizdeck.com/api/health" },
];

export default async function AdminHub() {
  await requireAdminPage();
  // status 모듈(lib/health) 재사용 — /api/status 와 같은 getStatus 를 RSC 에서 직접 호출한다(admin
  // 게이트 뒤라 안전, 자기-HTTP·인증 왕복 없음). checkDb 는 절대 throw 안 하므로 DB down 이어도 렌더된다.
  const status = await getStatus();

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold">어드민</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">콘텐츠 편집 · 사용자 조회 · 인프라 바로가기.</p>

      {/* 영역 진입 */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Link href="/admin/content" className="block">
          <Card padding={5} interactive>
            <div className="font-medium">콘텐츠 편집</div>
            <div className="mt-1 text-sm text-[var(--muted)]">시험 문항·개념을 편집합니다.</div>
          </Card>
        </Link>
        <Link href="/admin/users" className="block">
          <Card padding={5} interactive>
            <div className="font-medium">사용자</div>
            <div className="mt-1 text-sm text-[var(--muted)]">가입 사용자 목록을 조회합니다.</div>
          </Card>
        </Link>
      </div>

      {/* 상태 — /api/status 와 같은 lib/health.getStatus() 로 data tier 도달성·버전·업타임을 인앱에 */}
      <h2 className="mt-8 text-sm font-semibold text-[var(--muted)]">상태</h2>
      <Card padding={4}>
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <div className="text-xs text-[var(--muted)]">DB</div>
            <div className="mt-0.5 font-medium">
              <span className={status.db.status === "up" ? "text-green-600" : "text-red-600"}>
                {status.db.status === "up" ? "● up" : "● down"}
              </span>
              <span className="ml-1 text-xs text-[var(--muted)]">{status.db.latencyMs}ms</span>
            </div>
          </div>
          <div>
            <div className="text-xs text-[var(--muted)]">버전</div>
            <div className="mt-0.5 font-mono text-xs">{status.sha}</div>
          </div>
          <div>
            <div className="text-xs text-[var(--muted)]">업타임</div>
            <div className="mt-0.5 font-medium">{fmtUptime(status.uptimeSec)}</div>
          </div>
          <div>
            <div className="text-xs text-[var(--muted)]">확인</div>
            <div className="mt-0.5 text-xs text-[var(--muted)]">
              {new Date(status.now).toLocaleTimeString("ko-KR")}
            </div>
          </div>
        </div>
      </Card>

      {/* 인프라 바로가기 */}
      <h2 className="mt-8 text-sm font-semibold text-[var(--muted)]">인프라</h2>
      <ul className="mt-2 space-y-2">
        {INFRA.map((i) => (
          <li key={i.href}>
            <a href={i.href} target="_blank" rel="noopener noreferrer" className="block">
              <Card padding={4} interactive>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium">{i.label}</div>
                    <div className="mt-0.5 text-xs text-[var(--muted)]">{i.desc}</div>
                  </div>
                  <LuExternalLink className="size-4 shrink-0 text-[var(--muted)]" aria-hidden />
                </div>
              </Card>
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}
