# 0001 — Progress는 snapshot ProgressStore seam 뒤로, active Session은 기기-국소

Status: accepted

## 결정

[[CONTEXT.md#Progress|Progress]](한 학습자의 한 [[CONTEXT.md#Exam|Exam]] durable 기록)의 영속을 `ProgressStore` seam 뒤로 분리한다. interface는 **snapshot · async** 두 메서드다:

```ts
interface ProgressStore {
  load(key: string): Promise<Progress | null>
  save(key: string, progress: Progress): Promise<void>
}
```

도메인 mutation 로직(recordResult·toggleStar·setMemo·pushSession…)은 `useStoreState` 안에 남고, adapter는 기본값 파라미터로 주입한다(`useStoreState(examKey, store = localStorageProgressStore)`). 진행 중 [[CONTEXT.md#Session|Session]](active)은 Progress에서 분리해 **seam 없이 직접 localStorage**에 둔다.

## 왜

- **deep module.** interface 2개가 직렬화·debounce·레거시 blob split 마이그레이션·(미래) 네트워크를 전부 숨긴다.
- **async가 forward-design.** localStorage adapter도 Promise를 반환하므로, 후보 3(배포) 결정 후 네트워크 postgres adapter가 호출부 변경 없이 drop-in 된다.
- **interface = test surface.** localStorage + 테스트의 in-memory = 두 adapter → seam이 오늘부터 real. 도메인 규칙을 jsdom 없이 검증.

## 고려한 대안 (재제안 방지)

- **mutation-level / event(apply) interface** — row-level postgres·per-field merge엔 유리하나 interface가 wide → shallow. snapshot의 last-write-wins 한계를 알면서도 단일 사용자 셀프호스트엔 충분하다고 보고 **deep을 택함**. 진짜 동시-다기기 병합이 필요해지면 그때 deep module이 흡수한다(미리 사지 않음).
- **active Session도 동기화** — 진행 중 시도를 기기 간 동기화하는 건 의미상 이상하고, 매 이동마다 thrash해 remote write를 폭증시킨다. active는 두 번째 adapter가 영영 안 오므로 **seam을 두지 않는 게 정직**하다(가설 seam 회피).

## 결과

- snapshot last-write-wins → per-field merge 불가(의식적 수용).
- postgres adapter는 아직 없음 — 후보 3(static-export vs 서버) 결정에 묶임. 이 ADR은 seam과 분리까지만 확정한다.
- (#5) LWW(V2)가 양측 타임스탬프를 비교하도록 seam을 봉투 `StoredProgress { snapshot, updatedAt }`로 확장 — `load`는 봉투를, `save(key, snapshot, updatedAt)`는 메타를 수반한다. 도메인 `Progress`는 동기화 메타를 떠안지 않는다([[0003-auth-and-progress-sync.md|ADR-0003]]·DB `snapshot jsonb`/`updated_at` 분리와 정합). 위 `결정`의 snippet은 봉투 이전의 원래 계약을 보존한다.
