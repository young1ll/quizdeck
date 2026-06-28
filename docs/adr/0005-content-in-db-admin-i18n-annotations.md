# 0005 — 콘텐츠를 DB로(Question·Concept) + 웹 어드민(role) + i18n(같은 Question 변형) + Learner 주석(인용 앵커)

Status: accepted

## 맥락

[[0001-progressstore-seam.md|ADR-0001]]·[[0003-auth-and-progress-sync.md|ADR-0003]]은 콘텐츠(문항·개념·다이어그램)를 git `content/` JSON 으로 두고 **빌드타임 SSG** 로 렌더했다. 이제 세 가지를 더하려 한다: (1) [[../../CONTEXT.md#Learner|Learner]]가 문제·해설·선택지에 **밑줄·형광펜·인라인 메모**([[../../CONTEXT.md#Annotation|Annotation]])를 달고, (2) **영/한 전환**, (3) 콘텐츠를 **런타임 편집**(웹 어드민). 그릴링(2026-06-28)에서 세 요구를 분해하니 주석은 사용자 데이터·i18n 은 Question 변형이라 둘 다 콘텐츠 이전을 강제하지 않았으나, **런타임 편집** 요구가 콘텐츠를 DB 로 옮기는 결정을 이끈다.

## 결정

1. **주석 = Learner별 개인 데이터.** 밑줄·형광펜·인라인 메모는 [[0001-progressstore-seam.md|ADR-0001]]의 [[../../CONTEXT.md#Progress|Progress]]처럼 Learner 소유·동기화되며, 콘텐츠를 복제하지 않고 **참조(anchor)**만 한다. progress계 테이블(annotation)로.
2. **i18n = 같은 Question 의 언어 변형.** qn 정체성·정답·Progress(Wrong-list·stars·hist·시도기록)는 **언어 무관**. 언어는 q/options/explanation 텍스트의 표시 변형일 뿐.
3. **콘텐츠를 DB(postgres)로 이전.** 런타임 편집이 유일한 진짜 이유. DB VM(#4)을 재사용한다.
4. **편집 = 웹 어드민 UI 런타임 편집.**
5. **렌더링 = ISR + 어드민 편집 시 온디맨드 재검증**(`revalidatePath`). 콘텐츠가 공개라 캐시가 이상적 — SSG급 성능 + 편집 즉시반영.
6. **어드민 인가 = better-auth admin 플러그인(role).** `admin` role 이 `/admin`·콘텐츠 변경 API 를 게이트한다(미인증/비admin 거절).
7. **Question 스키마 = 문항당 1행.** 언어무관 컬럼(`exam_key`, `qn`, `topic`, `answer text[]`, `page`, `deeplink`) + `content jsonb {en:{q,options,explanation,tip}, ko:{…}}`. qn 이 정체성(Progress 조인 키 보존). Concept 도 같은 모양(언어무관 키 + content jsonb).
8. **주석 앵커 = 인용+문맥**(quote + prefix/suffix, W3C TextQuoteSelector 류). 렌더된 텍스트에서 인용을 매칭해 위치를 복원하고, 어드민이 그 부분을 바꿔 못 찾으면 **graceful orphan**(메모는 보존·위치만 떼어냄). 텍스트가 언어마다 달라 **언어별**.
9. **범위 = Question + Concept 을 DB 로.** Diagram(SVG)·q2svc·icons 는 파일·SSG 잔존(content 로더가 DB+파일 **하이브리드**). 주석은 우선 Question(문제·해설·선택지) 대상.

## 왜

- **콘텐츠를 DB로**: 런타임 편집(웹 어드민, 재배포 불요)이 git/PR·SSG 로는 불가능하다. (주석·i18n 만이면 파일 유지가 옳았다 — 런타임 편집이 분기점.)
- **ISR + 온디맨드 재검증**: 공개·읽기중심 콘텐츠라 매 요청 DB 조회(SSR)는 낭비. 캐시가 SSG 성능을 보존하고, 편집 시 해당 Exam 경로만 revalidate 해 즉시 반영한다.
- **i18n = Question 변형**: qn 정체성·Progress 를 언어 무관으로 보존해 진짜 '전환' UX. 언어별 별도 Exam 은 진도가 갈리고 전환이 약하다.
- **주석 = 사용자 데이터**: 밑줄·메모는 내 것 → progress계. 콘텐츠 복제 불요(참조).
- **인용 앵커**: 콘텐츠가 편집 가능해져 문자 오프셋은 드리프트로 깨진다. 인용+문맥은 편집에 견고하고 못 찾으면 우아하게 떨어진다(W3C/Hypothesis 방식).
- **admin 플러그인(role)**: 역할 체계가 미래 권한 확장(다중 편집자·밴 등)에 열려 있다.

## 고려한 대안 (재제안 방지)

- **콘텐츠 파일 유지 + 사용자데이터만 DB** — 가장 lean(SSG·git·버전관리 유지). 주석·i18n 만 필요했다면 이게 옳다. 하지만 **런타임 편집(웹 어드민)**을 못 해 탈락.
- **SSR(매 요청 DB)** — 단순하나 캐시 손실·DB VM 부하·지연. ISR 이 우월.
- **언어별 별도 Exam** — 단순하나 Progress 분리·전환 약함.
- **문자 오프셋 앵커** — 단순하나 편집 시 위치가 밀려 깨짐.
- **이메일 allowlist 어드민** — 최소이나 role 확장성 약함.
- **런타임 번역(LLM)** — 작성비용 0 이나 정답·기술용어 왜곡 위험.

## 결과

- **SSG 부분 폐기**: Question/Concept 렌더가 빌드타임 SSG → ISR. Diagram 등은 파일·SSG 잔존 → content 로더가 **DB+파일 하이브리드**가 된다.
- **신규 스키마**: `question`·`concept` 테이블(content jsonb), `annotation` 테이블(progress계, anchor + kind + memo), better-auth admin(`user.role` 등). 마이그레이션 추가.
- **마이그레이션**: 기존 `content/` JSON 을 DB 로 seed(qn 보존 → [[0001-progressstore-seam.md|ADR-0001]] Progress 무회귀). 기존은 단일 언어(`meta.language`)라 en/ko 중 **한 칸만** 채워짐 → 토글은 '변형 없음 → 가용 언어 폴백'.
- **어드민 표면**: `/admin` 라우트·CRUD·검증(정답 글자 ⊂ options)·revalidate. admin 인가가 새 보안 경계.
- **단계화(의존 순서)**: **A**(콘텐츠→DB + ISR) → **B**(어드민) → **C**(i18n) → **D**(주석). B·C 는 A 후, D 는 C 후(언어별).
- ADR-0001/0003 의 "콘텐츠=파일·SSG"는 **Question/Concept 에 한해** 갱신된다. Progress qn 정체성·동기화([[0003-auth-and-progress-sync.md|ADR-0003]]·#7)·로그인 게이팅([[0004-login-gating-and-email-verification.md|ADR-0004]])은 그대로 승계.
