# ADR-0016 — 주석 로컬 미러(새로고침·오프라인 생존), full composite 는 기각

- 상태: Accepted
- 날짜: 2026-07-06
- 관련: [[0005-content-authoring-and-storage]](주석 저장 D), 리뷰 C4(전송 어댑터 분리), ADR-0015(authorize seam) 다음 번호
- 코드: `lib/annotation-store-local.ts`(신규), `lib/annotation-context.tsx`, `lib/annotation-store-remote.ts`

## 맥락

주석([[../../CONTEXT.md]] Annotation)은 Learner 소유 · 기기 간 동기화되는 durable 데이터로 정의된다.
그런데 그동안 클라이언트 상태(`useAnnotationState`)는 **React state 에만** 있었다 — 서버가 권위이고
전송은 어댑터(`remoteApiAnnotationStore`, best-effort)가 소유하지만, 로컬 미러가 없었다. 결과:

- **새로고침하면 주석이 사라졌다**가 서버 로드가 끝나야 다시 나타난다(그전엔 빈 화면).
- **오프라인이면** 서버 로드가 실패(swallow)해 **빈 상태로 남았다** — 그 세션 동안 주석이 안 보인다.
- 오프라인에서 만든 주석은 PUT 이 실패(swallow)해 **영영 유실**됐다.

비교 대상인 [[../../CONTEXT.md]] Progress 는 `localStorageProgressStore` + `compositeProgressStore`
(localStorage 미러 + LWW 병합 + debounce + retry + SyncStatus)로 이 문제를 이미 푼다. 주석에도
같은 composite 를 지어야 하나? — 가 리뷰(annotation-sync)의 질문이었다.

## 결정

**localStorage write-through 미러**를 도입하되, **full composite 는 짓지 않는다.**

신규 `AnnotationCache`(`lib/annotation-store-local.ts`) — (Learner, Exam) 스코프의 동기 캐시:

- 팩토리 `localAnnotationCache(storage?)` — 기본 `window.localStorage`, SSR-safe(지연 해석), 주입식.
- `read(learnerId, exam)` / `write(learnerId, exam, items)` — 리스트 전체를 미러링.
- 키는 `quizdeck:annotations:<learnerId>::<exam>` — **learnerId 를 넣어 기기 공유 시 계정 간 노출을
  막는다**(progress localStorage 키보다 엄격).

`useAnnotationState` 가 이 캐시를 조합한다:

- **캐시 우선**: 마운트 시 캐시에서 즉시 복원 → 새로고침·오프라인에도 주석이 바로 보인다.
- **server-wins 재정합**: 서버 로드 성공 시 서버 데이터로 덮고 캐시를 다시 쓴다.
- **오프라인 유지**: 서버 로드 실패는 swallow 하되 **캐시 상태를 비우지 않는다**.
- **write-through**: add·update·remove·서버 로드가 상태를 바꾸면 캐시에 반영(items 이펙트).
- write 측 전송은 **여전히 best-effort**(어댑터가 소유, 훅이 swallow) — 변경 없음.

## 기각 대안

### (C) full composite(progress 대칭 — LWW·retry·SyncStatus)

progress 처럼 `compositeAnnotationStore` 를 지어 오프라인 write 를 큐잉·재전송하고 양측을 LWW 병합.
**기각.** progress 는 (Learner, Exam)당 **단일 봉투**를 LWW 하지만, 주석은 **컬렉션**(항목마다
id·updated_at)이라 LWW 가 **항목 단위 리스트 병합**이어야 한다 — progress 의 봉투 LWW drop-in 이
아니라 별도의 더 복잡한 머신이다. 주석은 학습 데이터가 아니라 **2차 표시**(밑줄·형광펜·메모)라
그 복잡도는 과중하다("미리 사지 않음"). ADR-0014 애던덤(affordance floor)처럼 **의도적으로
얕게 두고 결정을 기록**한다.

### (B′) localStorage 미러만(learnerId 스코프 없음)

progress localStorage 키처럼 exam 만으로 스코프. **기각** — 기기 공유 시 다른 Learner 로 로그인하면
서버 로드 전 잠깐 남의 주석이 보인다. learnerId 를 키에 넣으면 이 노출이 사라지고 비용도 없다.

## 수용하는 상한

server-wins 재정합이라 **순수 오프라인 생성 주석은 다음 온라인 로드가 덮어 유실**될 수 있다
(PUT 이 실패했고 재전송 큐가 없으므로). 이는 (C)를 안 지은 대가이며, 주석이 2차 표시라 수용한다.
흔한 증상(새로고침·오프라인에 기존 주석이 사라짐)은 해소된다. 이 상한이 문제가 되면 (C)로 승격한다.

## 결과

- 새로고침·오프라인에 주석·메모가 살아남는다(흔한 유실 해소).
- 새 seam `AnnotationCache` — 주입식·SSR-safe·단위테스트됨(`annotation-store-local.test.ts`).
  progress 처럼 "미러는 어댑터, 전송도 어댑터, 훅은 조합" 대칭이 완성된다.
- composite 를 안 지어 코드량·상태기계 복잡도는 progress 대비 낮게 유지된다.
