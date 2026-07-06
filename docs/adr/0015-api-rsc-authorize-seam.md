# 0015 — API/RSC 인가 seam: withLearner/withAdmin + throw-Response + 도메인 검증자

Status: accepted — 그릴링 2026-07-06 (아키텍처 리뷰 · 구현 `feat/route-guards`)

## 맥락

[[0003-auth-and-progress-sync.md|ADR-0003]]이 Route Handler(`app/api/*`)를 세우고, [[0004-login-gating-and-email-verification.md|ADR-0004]] 애던덤이 Learner 신원 경계를, [[0005-content-in-db-admin-i18n-annotations.md|ADR-0005]]이 admin 경계를 세웠다. 인증 **술어**는 클라-안전(`lib/learner`·`lib/admin-role`)/서버(`lib/learner-server`·`lib/admin`)로 잘 갈렸으나, 인증→거절+parse+error **envelope**은 라우트마다 재구현돼 있었다(아키텍처 리뷰 관찰):

- **누출 union**: `requireLearner(req)`가 `string | Response`라 매 핸들러가 `const id = await requireLearner(req); if (id instanceof Response) return id;`로 unwrap(5곳). 가드를 빠뜨리면 `Response` 객체가 `learnerId`로 store 에 넘어가는 **컴파일-통과 auth 우회**다.
- **비대칭**: `requireLearner`("5곳 401→1")의 딥닝이 admin 엔 없어, `getAdminSession`이 `null`을 반환하고 admin 라우트가 403을 재인라인(2곳)했다.
- **parse/게이팅 산재**: `try { req.json() } catch` 4곳, 게이팅 정책(401/403/redirect/notFound)이 ~6곳 인라인 리터럴로 소유 모듈 없음.
- **검증자 무테스트**: `isValidQuestion`(정답 ⊂ options 등)·`parseAnnotation`이 라우트 안 unexported라, 가장 로직 밀도 높은 도메인 불변식이 DB 통합 테스트(`skipIf(!DATABASE_URL)`)로만 커버돼 무-DB CI 에선 미검증.

## 결정

1. **고차 래퍼로 뒤집는다(`lib/route-guards.ts`).** `withLearner(handler)`·`withAdmin(handler)`가 세션을 해석해 실패면 401/403, 성공이면 핸들러를 **검증된 신원**(learnerId·AdminSession)으로 호출한다. 핸들러는 `Response`를 절대 인자로 받지 않으므로 유니온·unwrap 이 사라지고, 신원 없이는 핸들러가 실행조차 안 돼 **우회가 구조적으로 불가**하다.
2. **parse/검증 실패 = throw Response, 래퍼가 가로챈다.** `readJson(req)`은 bad json 시 400을 throw, 검증 실패도 `throw badRequest(...)`. 래퍼가 `catch (e) { if (e instanceof Response) return e; throw e }`로 잡아 핸들러가 **완전 선형**(unwrap·try/catch·if-return 없음)이 된다. Next 가 RSC 에서 `redirect/notFound`를 throw 로 쓰는 것과 같은 결.
3. **RSC 대칭 가드.** `requireLearnerPage()`(→`redirect("/")`)·`requireAdminPage()`(→`notFound()`)가 세션을 반환하거나 게이팅한다. 게이팅 정책 4종(401/403/redirect/notFound)이 전부 `route-guards`에 소유된다.
4. **검증자는 도메인 소유·순수.** `isValidQuestion`·`isValidConcept`는 `lib/content-validate`(순수, 타입 곁), `parseAnnotation`은 `lib/annotation`(Annotation 도메인 소유)으로. DB 없이 단위 테스트되고 클라-안전이라 ContentEditor 도 같은 규칙을 재사용할 수 있다.
5. **Response 헬퍼 단일 정의.** `unauthorized`·`forbidden`·`badRequest`·`noContent` — 상태·본문(및 향후 감사/레이트리밋)의 한 주인.
6. **규약**: 새 API 라우트는 `withLearner`/`withAdmin`으로, RSC 게이팅은 `requireXPage`로, 경계 검증은 도메인 모듈의 순수 함수로.

## 왜

- **구조적 우회 차단** — 핸들러가 신원을 인자로 받으므로, "가드를 빠뜨려 우회"가 타입상 불가능해진다(리뷰가 지적한 컴파일-통과 우회의 근본 해소).
- **대칭** — learner 에만 있던 딥닝을 admin·RSC 로 확장. `requireLearner`가 증명한 "복붙 401→1 주인"을 전 표면에.
- **검증 = 테스트 표면** — 도메인 불변식(정답 ⊂ options)이 순수 모듈로 나와 DB 없이 핀된다. 무-DB CI 에서도 가장 중요한 규칙이 검증된다.
- **선형 핸들러** — throw-Response 로 모든 거절이 한 곳에 수렴해 핸들러가 인가+위임만 남는다.

## 고려한 대안 (재제안 방지)

- **가드-결과 union 만 고침**(`{ok, learnerId} | {ok:false, res}`) — 오용은 줄지만 여전히 손 unwrap 이 남고 parse/error 를 모을 자리가 없다. 우회가 "구조적 불가"가 아니라 "가능성만 축소". 기각.
- **auth-only 래퍼(throw 안 잡음)** — 핸들러가 explicit-return 유지(레포 관용), 단 parse/검증 if-return 이 남아 완전 선형이 아니다. 사용자 선택으로 throw-가로채기 채택.
- **검증자를 -db 모듈에(validate-before-write)** — SQL 곁이나 `-db`는 pg import(서버 전용)라 ContentEditor 가 재사용 못 해 클라/서버 규칙 이중구현이 남는다. 도메인 소유가 낫다.

## 결과

- **신규**: `lib/route-guards.ts`(withLearner·withAdmin·requireLearnerPage·requireAdminPage·readJson·Response 헬퍼), `lib/content-validate.ts`(isValidQuestion·isValidConcept). `lib/annotation.ts`에 `parseAnnotation` 추가.
- **마이그레이션**: `app/api/{progress,annotations,admin/content}/route.ts` → 래퍼+선형 핸들러. RSC 4곳(`me`·`me/account`·`admin`·`admin/[exam]`) → `requireXPage`. 죽은 `requireLearner`(string|Response) 제거. `(learner)/page.tsx`는 게이팅 아닌 익명/Learner 조건부 렌더라 `getLearnerSession` 직접 사용 유지.
- **테스트**: `content-validate.test`(정답 ⊂ options 를 DB 없이 핀)·`annotation.test`의 parseAnnotation. 기존 route 테스트는 래퍼 통과로 동작 보존(13/13). 전체 225 통과.
- **미해결/후속**: 세션 캐스트(`as unknown as LearnerSession`) 검증화·클라/서버 명명 역전은 리뷰의 별도 후보(auth 술어 정합성). ContentEditor 의 `isValidQuestion` 재사용(콘텐츠 봉투 SSOT 후보)은 이 seam 이 해금하나 별도 작업.
- **[[../../CONTEXT.md|CONTEXT.md]] 무변경** — route-guard·withLearner 는 인프라 용어이지 도메인 글로서리(Learner·Progress·Annotation…)가 아니다.
