# 0004 — 로그인 게이팅(연습 한정) + 이메일 인증 필수 (전환 유도 모델)

Status: accepted

## 맥락

[[0001-progressstore-seam.md|ADR-0001]]·[[0003-auth-and-progress-sync.md|ADR-0003]]은 **"익명 사용은 그대로 — 로그인은 선택지일 뿐, 어떤 기능도 게이팅하지 않는다"**를 불변식으로 두었고, 이슈 #6은 SMTP 미구성을 이유로 **이메일 검증을 OFF**(가입 즉시 로그인)했다. 이제 인증(#6)·진도 동기화(#7)가 실제로 동작하므로, **로그인을 핵심 이용(연습)의 입구**로 만들어 계정 생성·기기 간 동기화 가치를 실현한다. 동시에 공개 가입을 여는 이상 봇·오타 이메일을 막을 **이메일 인증**이 필요해진다. (그릴링 2026-06-26)

## 결정

1. **소프트 게이트 — 연습만 게이팅.** [[../../CONTEXT.md#익명 방문자|익명 방문자]]는 Exam 카탈로그와 열람 콘텐츠(개념·다이어그램·서비스맵·검색)를 볼 수 있다. **연습**([[../../CONTEXT.md#Session|Session]] 시작·[[../../CONTEXT.md#Progress|Progress]] 기록)은 [[../../CONTEXT.md#Learner|Learner]] 전용이며, 연습 모드 클릭 시 **즉시 로그인**을 요구한다(맛보기 없음).
2. **게이트는 클라이언트 UX다(서버 강제 아님).** Exam 콘텐츠는 공개 SSG이고 연습은 Progress 저장 전까지 클라이언트 동작이라, 실 서버 경계는 이미 인증된 `/api/progress`뿐이다. 작정하면 클라이언트 게이트를 우회할 수 있으나 우회해도 동기화·서버 Progress를 얻지 못한다 → 이 게이트는 **접근 차단이 아니라 전환 유도**다.
3. **공개 가입 + 이메일 인증 필수.** `requireEmailVerification:true`. **Learner = 이메일 검증을 마친 인증 신원.** 검증 전엔 세션이 없어 익명처럼 열람만 가능하고, 미인증 로그인 시도엔 "이메일 인증 필요"를 안내하며 검증 메일을 재발송한다.
4. **트랜잭션 이메일 = Resend.** 검증 + 비밀번호 재설정을 보낸다. `myquizdeck.com` DKIM/SPF/DMARC를 Cloudflare DNS에 추가, API 키·발신주소(`EMAIL_FROM`)는 k8s Secret로 주입. (셀프호스트 주거 IP라 자체 SMTP는 도달성이 사실상 0 → 릴레이/API가 필수.)
5. **로그인 제시 = 인플레이스 모달.** 막힌 연습 모드에서 모달(로그인/가입, 기존 `AuthForms` 재사용)을 띄운다. **verified 로그인** 성공 시 막혔던 모드로 즉시 진입; **신규 가입**은 "메일 확인" 상태로 끝난다(검증 링크 → 앱 복귀 → autoSignIn).
6. **레거시 익명 Progress = 현 LWW 자동 병합 유지.** 게이팅 이전 localStorage에 쌓인 Progress는 첫 로그인 시 동일 키 LWW로 그 계정에 **무프롬프트 자동 승계**된다([[0003-auth-and-progress-sync.md|ADR-0003]]가 V3로 미룬 anonymous→login 병합의 naive 버전을 의식적으로 채택). 게이팅 후에는 신규 익명 Progress 자체가 생기지 않으므로 이 경로는 레거시 흡수 역할만 한다.
7. **비밀번호 재설정 포함.** 전송로가 생기는 김에 `sendResetPassword` 흐름도 추가한다(이메일 검증 필수인 이상, 비번 잊은 Learner의 영구 잠김을 막는다).

## 왜

- **전환·동기화 가치 실현.** #6·#7로 계정·동기화가 동작하므로, 연습=로그인으로 두면 Learner가 늘고 기기 간 학습이 실제로 쓰인다. 익명우선은 발견성엔 좋지만 계정 생성 동기를 약화시킨다.
- **소프트 게이트로 발견성 유지.** 콘텐츠를 공개로 두어 SEO·첫인상을 지키면서, 핵심 이용(연습)에만 로그인 가치를 건다. 전면 게이트보다 발견성↔전환 절충이 낫다.
- **클라이언트 게이트로 충분.** 학습 콘텐츠엔 민감정보가 없다. 서버 강제(콘텐츠 비공개화)는 발견성을 죽이고 비용이 과다 → "미리 사지 않음".
- **이메일 인증 필수 + Resend.** 공개 가입을 여는 이상 봇·오타 이메일 누적을 막아야 한다. 자체 SMTP는 주거 IP 도달성 0, Gmail SMTP는 트랜잭션 평판·500/일·개인계정 결합 문제 → Resend(무료 티어로 충분, DKIM 셋업, 좋은 DX)가 우월.
- **Learner=verified.** 미인증 계정이 Progress를 쌓으면 도메인이 흐려지고 동기화 대상이 모호해진다. 검증을 1급 경계로 둔다.

## 고려한 대안 (재제안 방지)

- **전면 로그인 게이트(콘텐츠도 비공개)** — 가장 단순하나 SEO·첫인상 손해 + 익명 방문자 개념 제거. 소프트 게이트가 발견성↔전환을 더 낫게 절충.
- **맛보기 N문항 후 게이트(ephemeral try)** — 전환율엔 유리하나 익명 임시 Session 경로를 새로 만들어야 하고 "연습=Learner" 도메인을 흐린다. 명료성을 위해 보류.
- **검증 OFF 유지(#6 그대로)** — 마찰 0이나 봇·오타·도달 불가 계정 누적. 공개 가입엔 부적합.
- **자체 SMTP / Gmail SMTP** — 자체는 주거 IP 도달성 불가; Gmail은 트랜잭션 부적합. Resend가 도달성·DX·비용에서 우월.
- **명시적 claim UX(V3 정식 병합)** — 공유기기 엣지엔 안전하나 추가 작업·새 봉투 흐름 필요. 개인 앱 규모엔 naive LWW 자동 병합으로 충분(엣지 감수).

## 결과

- **이메일 인프라 신규**: Resend 계정·도메인 검증, Cloudflare DNS(DKIM/SPF/DMARC), `RESEND_API_KEY`·`EMAIL_FROM` k8s Secret + Deployment env. (#6의 "SMTP 미구성, 검증 OFF" 결과를 갱신한다.)
- **`lib/auth.ts` 변경**: `emailAndPassword.requireEmailVerification:true` + `sendResetPassword`, `emailVerification.sendVerificationEmail`(+ `autoSignInAfterVerification`), Resend sender(`lib/email.ts`). 검증·재설정 링크 랜딩/UI.
- **클라이언트**: 연습 진입 게이트(verified-Learner 체크 → 로그인 모달, `AuthForms` 모달화), 익명용 Exam Home 조건부 축약(Progress 의존 블록 숨김 + 로그인 CTA), 익명의 히스토리 뷰 숨김.
- **도메인**: [[../../CONTEXT.md|CONTEXT.md]]에서 Learner = 이메일 검증된 신원, 익명 방문자(미인증 가입자 포함) = 열람 전용으로 갱신됨.
- ADR-0001/0003의 "익명 사용 불변식"은 **연습에 한해** 폐기된다(열람은 익명 유지). 동기화 LWW·active Session 비동기화 등 #7 결정은 그대로 승계.
- 후속 이슈로 슬라이스화: (A) 이메일 인프라 + better-auth 검증/재설정, (B) 연습 게이트 + 로그인 모달 + 익명 Home. B는 A의 verified-Learner 의미에 의존.
