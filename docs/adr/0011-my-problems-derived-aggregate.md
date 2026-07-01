# 0011 — 내 문제함: Progress facet들의 파생 union, per-Exam 실전 + /me 읽기전용 롤업

Status: accepted — 그릴링 2026-07-01 (구현은 후속 슬라이스)

## 맥락

학습자가 "자기에게 의미 있는 문항"에 닿는 경로가 파편화돼 있다 — [[../../CONTEXT.md#Wrong-list (오답노트)|오답(wrong)]]·즐겨찾기(star)·[[../../CONTEXT.md#Progress|Progress]]의 per-question 메모가 각각 Progress의 **별개 facet**이고, Home 모드 그리드에도 🔁오답노트·⭐즐겨찾기가 **서로 다른 타일**로 흩어져 있다(현재 모드 5개: `study·smart·exam·wrong·star`). 한편 [[0006-mypage-learner-hub.md|ADR-0006]]은 cross-Exam 활동을 `/me`에 모으는 방향을 냈으나 "내 문제"라는 **통합 개념**은 없다. 이 파편들을 하나의 개념으로 모은다. (그릴링 2026-07-01)

## 결정

1. **내 문제함 = 파생 union(저장 없음).** 한 [[../../CONTEXT.md#Learner|Learner]]의 한 [[../../CONTEXT.md#Exam|Exam]]에서 `wrong ∪ star ∪ memo`가 달린 문항. 별도 저장·동기화 표면 없이 Progress에서 **매번 계산** — [[../../CONTEXT.md#Mastery|Mastery]]처럼 파생 지표. 새 write 경로·새 sync 없음([[0001-progressstore-seam.md|ADR-0001]] seam 기조 유지).
2. **'담는 컨테이너'가 아니다.** 학습자가 담고 빼지 않는다 — membership은 세 facet에서 자동 도출(오답 맞히면, 별표·메모 없으면 자연 이탈). '함'은 **UI 은유**일 뿐 큐레이션 집합이 아니다. (curated 집합은 star가 이미 그 역할이라 글로서리 충돌.)
3. **두 층으로 산다.**
   - **per-Exam** `/[provider]/[exam]/내 문제함` — `[전체][틀린][별표][메모]` 필터 + 문항 목록 + **풀기**(한-시험 세션). content(문항 본문)가 이미 로드된 곳.
   - **cross-Exam** `/me/내 문제함` — 시험별 **개수 롤업(읽기전용)** + 각 시험 진입점. ADR-0006 대시보드의 all-progress 읽기(`lib/dashboard`) 재사용 — 값싸다.
4. **풀기는 한 Exam에 갇힌다.** [[../../CONTEXT.md#Session|Session]] 불변식(한 Exam 큐, `basePool`이 한 시험 `questions`에서 필터)을 지킨다. cross-Exam 큐는 만들지 않는다 — `/me`는 카운트 롤업 + 진입점이고 실제 목록·풀기·content 로드는 **시험 안에서**.
5. **fold: 오답·즐겨찾기 모드 타일 흡수.** Home 그리드 = `[학습][스마트][시험][내 문제함]`. 독립 ⭐🔁 타일 제거, 오답·즐겨찾기는 **내 문제함의 필터**로 강등. 단 **세션 레벨** Mode 값 `wrong`/`star`는 남고(필터 풀기가 그 모드로 시작), `[전체]` 풀기는 union을 큐로 하는 새 Mode(예: `mine`)가 필요.

## 왜

- 파생 union은 **새 데이터를 사지 않고**(ADR-0001 "미리 사지 않음") 이미 있는 세 facet을 읽어 통합 개념을 만든다 — 동기화 표면·마이그레이션 제로.
- 담는 집합이면 star와 사실상 중복(둘 다 "내가 고른 집합") → 글로서리 충돌. 파생 union은 진짜 새로운 것(aggregate view).
- `/me` 롤업을 **카운트로 한정**하면 cross-exam content 로드(무거움)와 세션 불변식 위반을 둘 다 피하고, 대시보드 데이터 경로를 재사용한다.
- fold는 모드 그리드 클러터를 줄이고([[0010-learner-ui-architecture.md|ADR-0010]] 허브 기조), "내 문제"를 한 집으로 모은다.

## 고려한 대안 (재제안 방지)

- **curated 문제함(담고 빼는 저장 집합, `myset: number[]`)** — 이름('함')엔 맞으나 새 write/sync 표면 + star와 중복. 기각(파생 union 채택).
- **hybrid(`union − dismissed` 저장)** — 파생 자동성 + 수동 제외. 저장 표면이 작게나마 생기고 지금 필요 없어 **보류**(필요해지면 재검토).
- **cross-Exam 세션(시험 섞은 큐)** — Session 불변식·`basePool`·content 조회((exam_key, qn))·quiz 컨트롤러 전면 개편. blast radius 최대, 기각.
- **`/me`에서 전 시험 문항 목록·풀기** — cross-exam content 로드가 무겁고 풀기는 한-시험이라, 카운트 롤업 + 시험 진입점으로 한정.
- **오답·즐겨찾기 타일 공존** — fast-path는 좋으나 진입점 중복·그리드 6타일. 흡수가 더 깔끔(필요 시 '바로풀기' 숏컷은 후속).
- **이름 '내 문제' / '복습'** — '복습'은 `smart`='스마트 복습'과 충돌. '내 문제함'을 UI 라벨로 쓰되 글로서리엔 **파생임을 명시**한다.

## 결과

- **CONTEXT.md**: `내 문제함` 용어 추가; `Wrong-list(오답노트)`는 "하나의 학습 모드" → "내 문제함의 오답 필터"로 신분 조정(0011에서 반영).
- **Mode enum**: `[전체]` 풀기용 union Mode(예: `mine`) 신설 검토 — `basePool`에 `wrong∪star∪memos` 필터 추가. `wrong`/`star`는 필터 풀기용으로 유지. (구현 세부는 슬라이스에서.)
- **라우트**: per-Exam `내 문제함` 뷰(허브-스포크, ADR-0010 참조 라우트 결) + `/me/내 문제함` 롤업(대시보드 확장).
- **Home**: ⭐🔁 타일 제거, `내 문제함` 타일 추가.
- 후속/미정: `[전체]`·`[메모]` 풀기의 정확한 큐·정렬, 빈 상태, 모바일 필터 UX, (필요 시) '바로풀기' 숏컷, hybrid dismiss.
