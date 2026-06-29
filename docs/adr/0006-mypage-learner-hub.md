# 0006 — 마이페이지(Learner 허브): 계정 관리 먼저, 학습 대시보드는 후속

Status: accepted

## 맥락

지금까지 인증은 로그인·가입·이메일 인증·비밀번호 재설정([[0004-login-gating-and-email-verification.md|ADR-0004]])만 갖췄고, **로그인한 [[../../CONTEXT.md#Learner|Learner]]가 자기 계정을 관리할 면**이 없다 — 로그인 상태에서 비밀번호를 못 바꾸고(이메일 재설정으로만 가능), 이름 수정·이메일 변경·회원 탈퇴도 불가능하다. 한편 [[../../CONTEXT.md#Progress|Progress]]·[[../../CONTEXT.md#Annotation|Annotation]]은 Exam별로만 보이고 "여러 Exam을 가로지른" 통합 현황이 없다(용어집: *한 Learner는 여러 Exam의 Progress를 가진다*). **마이페이지**로 이 둘 — 내 계정 + 내 활동 — 을 한 곳에 모으려 한다.

## 결정

1. **마이페이지 = Learner 허브(계정 + 활동).** `/me` 최상위 라우트(Exam 횡단 — 시험별 SPA `/[provider]/[exam]`와 분리), **Learner 전용**(익명·미인증 → 로그인 유도), `AccountMenu`가 진입점.
2. **계정 관리부터.** 1차 MVP = 프로필(이름) 수정 · 비밀번호 변경 · 회원 탈퇴. 진짜 능력 갭이고 잘 바운드되며 새 데이터 아키텍처가 불필요하다. 계정 작업은 **User**(인증 자격: 이름·이메일·비번·존재)에 작용 — 활동/Progress의 **Learner**와 구분되는 용어집의 두 축.
3. **회원 탈퇴 = DB FK cascade + 비밀번호 확인.** `deleteUser({ password })`(better-auth) + 타이핑 확인 모달. 데이터 정리는 **DB `ON DELETE CASCADE` FK**로 선언적으로 — Progress(0002)는 이미 `references "user"("id") on delete cascade`, Annotation(0005)은 FK가 없어 **0006 마이그레이션으로 추가**한다. `user` 행 삭제 → Progress·Annotation·session·account 가 함께 자동 정리.
4. **비밀번호 변경 시 다른 세션 폐기**(`revokeOtherSessions: true`).
5. **학습 대시보드는 후속 슬라이스.** cross-exam 집계(여러 Exam의 Progress를 **계정 레벨**에서 모아 [[../../CONTEXT.md#Mastery|Mastery]]·연속학습일·오답/즐겨찾기 수 등)는 **새 데이터 경로**(전 Exam Progress 로드/집계 — 현재 Progress 는 ExamApp 안에서 examKey 별로만 로드)가 필요해, 계정 MVP 와 분리해 신중히 결정한다. 허브에 '활동' 섹션으로 합류.
   - **집계 경로(이슈 #37 에서 해소)**: `/me` **서버 컴포넌트가 progress 전 행을 DB 에서 직접 읽고 순수 함수(lib/dashboard)로 집계**한다 — 새 API 엔드포인트·클라 fetch·로딩 상태 없음(content.ts 가 RSC 에서 DB 읽는 것과 같은 결). 대시보드는 읽기 전용 표시라 RSC 가 자연스럽고, `mastery`·streak 도출은 Home 의 per-exam 통계와 같은 정의를 재사용한다. DB(동기화된 Progress)가 소스라 기기 간 정합 — 막 만든 미동기 로컬 변경은 동기화 후 반영. (대안: 전용 `/api/progress/summary`·목록 모드 — 한 겹 더라 보류.)
6. **이메일 변경도 후속.** `requireEmailVerification: true` 때문에 새 주소 재인증(pending) 플로우 무게가 있어 별도 슬라이스(`sendChangeEmailVerification` 설정 + 검증 경로).

## 왜

- 계정 관리는 사용자가 즉시 체감하는 공백(비번 한 번 바꾸려 이메일 재설정을 도는 마찰)을 메우고, better-auth 기본 능력 위에 얇게 얹힌다.
- 탈퇴 cascade 를 **FK 로** 두면 앱 코드가 정리를 빠뜨릴 수 없다(주석 고아 방지) — better-auth 가 자기 테이블만 지워도 우리 도메인 테이블이 함께 사라진다.
- 대시보드를 분리하면 "여러 Exam 집계"라는 진짜 아키텍처 결정을 MVP 압박 없이 내릴 수 있다.

## 고려한 대안 (재제안 방지)

- **탈퇴 cascade 를 앱 훅(`beforeDelete`)으로 수동 삭제** — 선언적 FK 보다 누락·표류 위험. 기각.
- **대시보드 먼저** — 동기부여 가치는 크나 cross-exam 집계 경로가 없어 큰 작업. 계정 갭이 더 급하고 작다.
- **AccountMenu 드롭다운 확장(전용 페이지 없음)** — 허브(계정+활동)를 담기엔 작다.
- **이메일-링크 탈퇴 확인** — 더 안전하나 Resend 템플릿+검증 라우트 추가. 비번 확인으로 충분(비번을 알아야 가능).

## 결과

- **0006 마이그레이션**(annotation `learner_id` FK + `on delete cascade`) 추가 — 다른 마이그레이션처럼 **배포 전 적용 게이트**. 기존 annotation 행의 learner_id 가 모두 유효해야 FK 추가 성공(세션 learner_id 로만 생성됐으므로 충족).
- `lib/auth.ts` 에 `user.deleteUser.enabled` 활성화, `lib/auth-client.ts` 에 `updateUser`/`changePassword`/`deleteUser` export.
- 후속 이슈: 학습 대시보드(cross-exam 집계, 허브 '활동' 섹션) · 이메일 변경(재인증). 세션 관리·프로필 이미지는 미정(필요 시).
