# quizdeck

여러 자격·기술 시험(AWS, CNCF, Cisco 등)을 위한 학습 퀴즈 도구. 이 글로서리는 도메인 용어를 고정한다 — 구현 세부는 담지 않는다.

## Language

**Exam**:
하나의 자격 시험(예: SAP-C02). 문항·개념·다이어그램을 묶는 범위(scope)이며, 학습 기록이 귀속되는 단위다.
_Avoid_: test, quiz(quiz는 푸는 행위), course

**Topic (주제)**:
한 [[#Exam|Exam]] 안에서 문항을 묶는 주제 분류(예: '스토리지'·'비용 최적화'). **정체성과 라벨을 가른다** — 그룹·필터·per-topic 통계의 키는 **언어 무관 안정 id**(canonical 언어 슬롯의 topic 에서 파생)이고, 화면 **표시 라벨**은 지역화 텍스트라 언어 토글 시 바뀐다([[#Annotation|Annotation]]처럼 텍스트가 언어별). [[#Progress|Progress]]는 topic 을 저장하지 않고 문항→topic 을 매번 파생하므로(qn 이 정체성) 언어에 안전하다. 라벨을 키로 쓰면 언어 토글 시 필터가 비므로 **키는 반드시 id**.
_Avoid_: category(개념의 cat 과 혼동), 지역화 라벨을 그룹/필터 키로 사용

**Learner**:
**이메일 검증을 마친** 인증 신원. 자신의 [[#Progress|Progress]]를 소유하고 기기를 가로질러 동기화한다. [[#익명 방문자|익명 방문자]]와 달리 **연습**([[#Session|Session]] 시작·Progress 기록)은 Learner만 할 수 있다. 가입했으나 이메일 미인증인 사용자는 **아직 Learner가 아니다**(인증 전엔 세션 없음). 한 Learner는 여러 Exam의 Progress를 가진다.
_Avoid_: User(인증 자격/행 식별자일 뿐), Account(자격증명 묶음), member, 미인증 가입자

**익명 방문자 (Anonymous visitor)**:
인증된 Learner가 아닌 모든 방문자(가입 후 **이메일 미인증** 사용자 포함). [[#Exam|Exam]] 카탈로그와 Exam의 **열람 콘텐츠**(개념·다이어그램·서비스맵·검색)는 볼 수 있으나 **연습할 수 없다** — Session 시작과 Progress 기록은 [[#Learner|Learner]] 전용이다. 따라서 익명 방문자는 Progress를 갖지 않는다(연습 모드 진입 시 로그인 요구).
_Avoid_: guest(1급 신원·게스트 계정을 암시), User

**Progress**:
한 **Learner**의 한 Exam에 대한 **durable 학습 기록** — 문항 이력, 오답 목록, 즐겨찾기, 메모, 일일 활동, 완료한 시도 기록, 환경설정. 시도와 기기를 가로질러 살아남는 단위. 영속 키는 (Learner, Exam).
_Avoid_: Store, state, data, save

**Session**:
진행 중인 **한 번의 퀴즈 시도** — 선택된 문항 큐, 현재 위치, 선택, 검토 표시, 시간. 일시적이며, 끝나면 요약을 남겨 Progress의 시도 기록에 합류한다. Progress와 달리 동기화 대상이 아니다.
_Avoid_: run, attempt(시도 기록이 아닌 '진행 중'을 가리킬 때), active

**Mastery**:
한 Exam에서 마지막에 정답으로 맞힌 문항의 비율. Progress에서 파생되는 학습도 지표.
_Avoid_: score(점수는 한 Session의 결과), [[#정답률 (Accuracy)|정답률]]

**정답률 (Accuracy)**:
한 [[#Exam|Exam]]에서 **전 시도 중 정답의 비율**(correct/attempts) — 재시도를 포함한 시도 단위 정확도. [[#Progress|Progress]]에서 파생되는 학습도 지표이며 [[#Mastery|Mastery]]와 **다른 지표**다: Mastery는 *마지막에 정답인 문항 / 총 문항*(현재 상태), 정답률은 *정답 시도 / 전체 시도*(누적 정확도). 두 지표는 한 화면에 나란히 설 수 있고(예 /stats·/me), 모든 화면이 **같은 단일 정의**를 공유한다.
_Avoid_: [[#Mastery|Mastery]]·숙련도(마지막 정답 비율은 Mastery), score(한 Session 결과), 'mastered/seen'(숙련도의 변형일 뿐 정답률 아님)

**Wrong-list (오답노트)**:
현재 오답으로 추적되는 문항 집합. 틀리면 자동 편입되고, 이후 맞히면 빠진다. [[#Progress|Progress]]의 일부이자 [[#내 문제함|내 문제함]]을 이루는 세 축 중 하나 — 내 문제함에서 '틀린' 필터로 드러난다(더는 독립 학습 모드로 노출하지 않는다).
_Avoid_: mistakes, failures

**내 문제함 (My Problems)**:
한 [[#Learner|Learner]]의 한 [[#Exam|Exam]]에서 **주목할 문항을 한데 모은 파생 뷰** — [[#Wrong-list (오답노트)|오답]]·즐겨찾기(star)·[[#Progress|Progress]]의 per-question 메모가 달린 문항의 **합집합(union)**이다. **담는 저장소가 아니라 Progress에서 매번 파생되는 뷰**여서 따로 담고 빼지 않는다('함'은 UI 은유일 뿐). 오답을 맞히거나 별표를 풀면(다른 이유가 없으면) 자연히 빠진다 — [[#Mastery|Mastery]]처럼 파생 지표. 시험별로 존재하며, 계정 레벨(cross-Exam)에는 시험별 개수 롤업으로만 모인다.
_Avoid_: 즐겨찾기·오답노트(내 문제함의 필터일 뿐), 복습(스마트 복습 모드와 혼동), 문제집(Exam 구어와 충돌), [[#컬렉션 (Collection)|컬렉션]](그건 별도의 큐레이션 엔티티 — 내 문제함은 파생 뷰라 담고 빼지 않는다)

**컬렉션 (Collection)**:
한 [[#Learner|Learner]]가 문항을 **직접 담고 빼서 이름 붙여** 만드는 큐레이션 세트. [[#내 문제함 (My Problems)|내 문제함]](파생·자동)과 달리 명시적으로 구성하며, 항목이 (Exam, 문항) 참조라 **Exam 경계를 넘는다**(cross-Exam). Learner 소유·기기 간 동기화(서버 소스, id 기반 CRUD). 풀기는 시험별 진입(지금) → 혼합 큐(예정, ADR-0022 S2). 같은 (Exam, 문항)은 한 컬렉션에 한 번만.
_Avoid_: 문제집(Exam 구어), 내 문제함(파생 — 담고 빼지 않음), star·즐겨찾기(per-Exam 단일 facet — 컬렉션은 이름 있는 다중 세트)

**Annotation (주석)**:
한 [[#Learner|Learner]]가 콘텐츠(문제·해설·선택지) 텍스트의 한 **구간**에 다는 개인 표시 — 밑줄·형광펜·인라인 메모. [[#Progress|Progress]]처럼 Learner 소유이고 기기 간 동기화되며, 콘텐츠를 복제하지 않고 **참조(anchor)**로 가리킨다. 텍스트가 언어마다 다르므로 **언어별로 따로** 달린다(EN 형광펜은 KO 화면에 안 보임). Progress의 per-question 메모보다 세밀하다(문항 단위가 아니라 텍스트 구간 단위).
_Avoid_: highlight(형광펜은 Annotation의 한 종류일 뿐), note, 메모(인라인 메모도 Annotation의 한 종류)

**서비스 (Service)**:
provider(예: "aws")에 귀속되는 **정체성 실체** — 언어 무관 안정 id·이름·약어·아이콘·분류. 시험이 아니라 provider가 소유하며, 여러 [[#Exam|Exam]]이 같은 서비스를 다룬다. [[#개념 카드 (Concept card)|개념 카드]]가 서비스를 0..n개 **참조**한다. 표시 라벨을 키로 쓰지 않는다 — [[#Topic (주제)|Topic]]과 같은 규칙(라벨은 바뀌어도 id는 불변).
_Avoid_: 개념(카드 층과 혼동), svc 라벨을 식별자로 사용

**개념 카드 (Concept card)**:
한 [[#Exam|Exam]]에 귀속되는 **학습 노트** — 그 시험의 눈높이로 쓰인 정의·핵심·언제·함정·비교. [[#서비스 (Service)|서비스]]를 0..n개 참조한다: 단일 서비스 카드(EFS), 비교·묶음 카드(2개 이상 — "ALB vs NLB"), 전략 카드(0개 — "DR 전략"). **같은 서비스라도 시험마다 다른 카드가 정당하다**(associate와 professional의 함정은 다르다 — 2026-07-14 실측: 두 시험 교집합 27개 카드의 교육 필드가 27/27 분화). 정체성(이름·아이콘)은 카드가 아니라 서비스의 것이다.
_Avoid_: 서비스(정체성 층 — 카드는 교육 층), 개념(양쪽을 뭉뚱그리는 구 용어), 백과사전 항목(시험 무관 단일 정본을 암시)
