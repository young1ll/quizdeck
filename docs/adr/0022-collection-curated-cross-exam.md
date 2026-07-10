# 0022 — 컬렉션: Learner 큐레이션 cross-Exam 문항 세트 (ADR-0011 부분 재개봉)

- 상태: Accepted — 그릴링 2026-07-09 (데이터 모델 개선 검토 ①, 사용자 결정)
- 관련: [[0011-my-problems-derived-aggregate.md|ADR-0011]](부분 재개봉 — 아래 명시) · [[0016-annotation-local-mirror.md|ADR-0016]]·`0005_annotation.sql`(저장·API 패턴 선례) · [[0003-auth-and-progress-sync.md|ADR-0003]](Learner 데이터 동기화) · [[0012-learner-ia-audit.md|ADR-0012]](/me IA)
- 코드: `db/migrations/0008_collection.sql` · `lib/collection.ts`(도메인) · `lib/collection-db.ts` · `app/api/collections/route.ts` (S1 백엔드) — UI·혼합 큐는 후속 슬라이스

## 맥락

[[0011-my-problems-derived-aggregate.md|ADR-0011]]은 내 문제함을 **파생 union**으로 정의하며 두 대안을 기각했다: (a) 담고 빼는 curated 집합(star 중복 논거), (b) cross-Exam 혼합 세션(Session 불변식·blast radius). 이번 데이터 모델 검토에서 사용자가 "문제집(Exam) 상관없이 직접 구성"을 명시 요구했고, 수위 선택에서 **L3(큐레이션)+L2(혼합 큐)** 를 채택했다 — 기각안 재개봉이므로 근거 변화를 기록한다.

## 결정

1. **컬렉션 = Learner 소유 큐레이션 엔티티.** 이름 붙인 문항 세트로, 학습자가 명시적으로 담고 뺀다. items = `(examKey, qn)` 참조라 **Exam 경계를 넘는다**. **내 문제함과 공존** — 내 문제함은 파생(자동 편입·이탈), 컬렉션은 큐레이션(수동 구성). ADR-0011의 star-중복 논거는 컬렉션이 **cross-Exam + 이름 있는 다중 세트**라는 차별점으로 해소된다(star 는 per-Exam 단일 facet).
2. **저장·API = annotation 패턴**(0005/ADR-0016 계열): `collection(id[client uuid], learner_id FK cascade, name, items jsonb, updated_at)` + `/api/collections` CRUD(`withLearner` — learner_id 는 항상 세션에서, 타인 접근 구조 차단 + upsert WHERE 가드). 경계 검증은 순수 `parseCollection`(이름 trim·60자, items 500 한도, (examKey,qn) 중복 정규화)이 소유. 서버 소스(로컬 미러 없음) — 저빈도 편집이라 LWW snapshot(progress 패턴)보다 행 단위 CRUD 가 충돌 의미론 단순.
3. **풀기 = 혼합 큐까지(사용자 결정 — ADR-0011 결정 4 재개봉).** 여러 Exam 문항을 한 세션 큐로. 세션 아이템이 `(examKey, qn)` 복합키가 되고 결과 기록이 examKey 별 Progress 로 분기한다 — Session·기록 경로 재설계가 필요한 **별도 슬라이스(S2)**.
4. **스테이징.** **S1** = 엔티티+CRUD(이 커밋) → **S1.5** = UI(/me 컬렉션 목록·상세, 담기/빼기 진입점, **시험별 풀기** — Session 불변식 안에서 즉시 가치) → **S2** = 혼합 큐 세션(재설계 그릴링 후). S1.5 의 시험별 풀기는 S2 가 와도 그대로 남는 경로(시험 하나짜리 컬렉션·시험별 진입)다.
5. **용어.** CONTEXT.md 에 `컬렉션` 등록. '문제집'은 Exam 구어라 기각. 내 문제함 항목의 avoid 문구를 재정리(컬렉션은 이제 별개 실체).

## 기각 대안 (재제안 방지)

- **progress 패턴(LWW snapshot·local-first)** — 컬렉션 전체를 snapshot 으로 동기화. 오프라인 편집은 얻지만 기기 간 편집 충돌 시 통째로 지는 쪽 유실. id 있는 명시 엔티티엔 행 단위 CRUD 가 맞다. 기각(사용자 선택).
- **'세트' 등 다른 이름** — '컬렉션' 채택(사용자 선택). '문제집'은 Exam 구어 충돌.
- **collection_item 정규화 테이블** — 행 폭발 대비 이점 없음(컬렉션당 ≤500, 통째 upsert 가 편집 단위). items jsonb 인라인 채택.

## 결과

- 새 보안 경계 1(API — withLearner + WHERE 가드), 새 테이블 1(0008 — **앱 배포 전 선적용**, 0005/0007 선례).
- ADR-0011 은 내 문제함(파생)에 대해 **여전히 유효** — 재개봉된 것은 "큐레이션 엔티티 부재"와 "혼합 큐 금지"뿐. 내 문제함이 컬렉션으로 바뀌는 게 아니다.
- S2(혼합 큐)는 세션 복합키·다중 Progress 기록·콘텐츠 배치 로드 설계를 확정하는 후속 그릴링이 선행돼야 한다 — 이 ADR 은 방향만 고정한다. → **애던덤에서 확정(2026-07-10)**.
- CONTEXT.md 갱신(컬렉션 추가, 내 문제함 avoid 조정).

## 애던덤 — S2 혼합 큐 설계 확정 (그릴링 2026-07-10)

- 코드: `lib/mixed-session.ts`(순수) · `lib/use-mixed-quiz.ts` · `components/collections/MixedQuizClient.tsx` · `app/(learner)/me/collections/[id]/quiz/page.tsx` · Mode `"collection"`(progress/store/mode-icons)

1. **기록 = 완전 기록.** 혼합 세션의 문항 제출은 **소속 시험의 Progress** 에 기록된다(이력·오답·활동일 — 시험 안 풀기와 동일). 무기록 스크래치 모드는 기각 — 컬렉션 복습이 학습 시스템(오답→내 문제함→mastery) 밖의 연습장이 되는 것을 거부.
2. **멀티스토어 = StoreBridge 패턴.** 시험당 렌더되는 브릿지 컴포넌트가 기존 `useStoreState`(composite local+remote LWW)를 호출해 ctx 를 부모로 보고 — 시험 목록이 마운트 시 고정이라 훅 규칙과 무충돌, store 로직 신설 0. 별표·메모도 같은 라우팅.
3. **세션 코어 = 인덱스 큐로 무변경 재사용.** 큐를 아이템 배열 **인덱스**(0..n-1)로 돌려 `sessionReducer`·`currentView`·`computeResult` 를 그대로 쓰고, `(examKey, qn)` 은 기록 경계에서만 번역(`lib/mixed-session`). SAA q7/SAP q7 충돌이 원천 소거 — 제네릭화·병렬 reducer 모두 불필요해짐.
4. **UI = 경량 전용 뷰(결정 B).** 문항·채점·해설·진행 + 별표·메모. 주석·개념 링크·주제 칩은 v1 제외(완전한 형태는 S1.5 '이 시험에서 풀기'가 소유). **기존 Quiz.tsx 무변경**(회귀 0) — 재사용+컨텍스트 스와핑은 orderCache qn 충돌·시험 전체 페이로드 문제로 기각.
5. **일회성.** 영속(setActive) 없음 — 나가면 세션 종료, 제출분은 이미 기록됨. 로컬 resume 은 컬렉션 편집-정합 문제가 따라와 v1 에 사지 않음.
6. **세션 기록 = 시험별 분할 + Mode `"collection"`.** 종료 시 각 시험 Progress.sessions 에 (n=그 시험 문항, ok=정답, sec=문항수 비례 배분) 기록. enum·라벨·아이콘 additive. mode 를 study 로 위장하는 안은 데이터 정직성 때문에 기각.
7. **study 흐름 전용.** 타이머·시험 모드 없음 — exam 모드는 per-exam 풀기가 소유.
8. **콘텐츠 = 참조 문항만 배치 로드.** `loadQuestionsByKeys` 가 answer 컬럼 포함 풀 콘텐츠를 IN 조회로 — 시험 전체 로드 없음(재개봉 근거 유지).
