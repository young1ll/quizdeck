# 0019 — 구조화 로깅은 stdout JSON 한 줄, 어댑터 seam 은 아직 두지 않는다 + admin status 카드

- 상태: Accepted — 그릴링 2026-07-08 (아키텍처 리뷰 인프라·가시성 · 후보 B)
- 관련: [[0001-progressstore-seam.md|ADR-0001]]('가설 seam 회피') · [[0015-api-rsc-authorize-seam.md|ADR-0015]](route-guards catch) · [[0017-admin-operational-surface.md|ADR-0017]](admin 허브) · [[0018-health-status-module.md|ADR-0018]](getStatus 재사용)
- 코드: `lib/log.ts`(신규) · `lib/route-guards.ts`(catch 로깅) · `lib/auth.ts`·`lib/email.ts`(warn 통일) · `app/admin/page.tsx`(status 카드)

## 맥락

[[0002-synology-vpc-platform.md|ADR-0002]]의 관측성 층(L4)은 아직 없다. 리포트는 후보 B 의 핵심으로 "`lib/log` 단일 로깅 seam(console 어댑터 지금 → Loki 나중)"을 제시했으나, 코드를 보면 `console.warn` 은 **딱 2곳**(auth·email 의 startup/dev env-누락 경고)뿐이고 Loki 같은 수집처가 없다. 이 2곳을 어댑터-교체 seam 으로 감싸는 것은 두 번째 어댑터가 실재하지 않는 **가설 seam** — [[0001-progressstore-seam.md|ADR-0001]]이 명시적으로 경계한 것이다.

진짜 관측성 구멍은 다른 데 있었다: **API 라우트의 예상 밖 예외가 완전히 침묵**한다. `route-guards` 의 `withLearner`/`withAdmin` catch 가 non-Response 예외를 그냥 re-throw → Next 500 → 로그 0. 여기엔 실 소비자(모든 API 라우트의 예외)가 있다.

## 결정

1. **`lib/log.ts` = 구조화 stdout, 어댑터 seam 없음.** `log.error/warn/info(msg, fields)` 가 한 줄 JSON(`{...fields, level, msg, time}`)을 stdout/stderr 로 낸다. Error 필드는 `{name,message,stack}` 으로 편다(JSON.stringify 가 Error 를 `{}` 로 만드는 것 회피). **어댑터 교체 지점을 두지 않는다** — pod stdout 이 이미 `kubectl logs` 로 보이고, Cloudflare Logpush/Loki 가 켜지면 호출부 변경 없이 그대로 쿼리된다. 실 수집처가 생기기 전의 `setLogAdapter` 류는 가설 seam이라 사지 않는다.
2. **침묵하던 API 예외에 목소리.** `route-guards` 의 두 catch 가 re-throw 전에 `log.error("api 핸들러 예외", { method, path, err })`. 기대된 실패는 Response 로 throw 돼 위에서 반환되므로 노이즈 없음 — 오직 예상 밖 예외(DB 장애·버그)만 남는다.
3. **기존 2곳 warn 통일.** auth·email 의 `console.warn` 을 `log.warn(msg, {fields})` 로 — 단일 로깅 표면. (email dev 폴백은 to·subject·text 를 필드로 보존.)
4. **admin status 카드.** `/admin` 허브(ADR-0017, 지금껏 하이퍼링크 4개뿐)에 `lib/health.getStatus()` 를 **직접 호출**(admin 게이트 뒤라 안전, 자기-HTTP·인증 왕복 없음)해 db up/down·latency·sha·uptime 카드를 렌더. [[0018-health-status-module.md|ADR-0018]]의 status 모듈이 이제 API(`/api/status`)와 RSC(허브) 둘을 먹인다 — shallow 하이퍼링크 목록이 실제 status 표면으로 깊어진다.

## 기각 대안

### 완전 lib/log 어댑터 seam(console + noop/test 어댑터, `setLogAdapter`)

ports & adapters 로 로깅을 추상화. **기각** — Loki 소비자가 없어 어댑터-교체 seam 자체가 가설이다([[0001-progressstore-seam.md|ADR-0001]]). 구조화 JSON stdout 만으로 나중 Loki/Logpush 도입 시 충분히 쿼리되므로, seam 은 두 번째 수집처가 실재할 때 deep module 이 흡수한다(미리 사지 않음).

### 기존 2곳 warn 을 seam 으로 감싸는 것을 B 의 핵심으로

**기각** — 그 2곳은 startup/dev 경고라 저-가치이고, 진짜 구멍은 침묵하는 API 예외였다. 리포트의 이 부분을 재조준했다.

## 결과

- API 500 이 구조화 로그를 남긴다(지금은 `kubectl logs`, 수집 켜지면 쿼리 가능) — ADR-0002 L4 의 첫 발.
- 로깅 표면이 `lib/log` 하나. Loki/Logpush 는 이 stdout 을 수집하면 되고, 어댑터 seam 은 그때 판단.
- admin 이 앱 안에서 data tier 상태·라이브 sha·uptime 을 본다(호스티드 대시보드 이탈 불필요).
- Cloudflare 엣지 관측(Web Analytics·Logpush)은 대시보드 손작업이라 이 커밋 밖 — 운영 체크리스트로 남긴다.
- CONTEXT.md 무변경(로깅·status 카드는 운영 표면).
