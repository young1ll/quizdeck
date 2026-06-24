# quizdeck

여러 자격·기술 시험(AWS, CNCF, Cisco 등)을 위한 학습 퀴즈 도구. 이 글로서리는 도메인 용어를 고정한다 — 구현 세부는 담지 않는다.

## Language

**Exam**:
하나의 자격 시험(예: SAP-C02). 문항·개념·다이어그램을 묶는 범위(scope)이며, 학습 기록이 귀속되는 단위다.
_Avoid_: test, quiz(quiz는 푸는 행위), course

**Learner**:
인증된 신원. 자신의 [[#Progress|Progress]]를 소유하고 기기를 가로질러 동기화한다. 익명 방문자는 Learner가 아니며, 그 기록은 기기-국소 localStorage에만 머문다(동기화 대상 아님). 한 Learner는 여러 Exam의 Progress를 가진다.
_Avoid_: User(인증 자격/행 식별자일 뿐), Account(자격증명 묶음), member

**Progress**:
한 **Learner**의 한 Exam에 대한 **durable 학습 기록** — 문항 이력, 오답 목록, 즐겨찾기, 메모, 일일 활동, 완료한 시도 기록, 환경설정. 시도와 기기를 가로질러 살아남는 단위. 영속 키는 (Learner, Exam).
_Avoid_: Store, state, data, save

**Session**:
진행 중인 **한 번의 퀴즈 시도** — 선택된 문항 큐, 현재 위치, 선택, 검토 표시, 시간. 일시적이며, 끝나면 요약을 남겨 Progress의 시도 기록에 합류한다. Progress와 달리 동기화 대상이 아니다.
_Avoid_: run, attempt(시도 기록이 아닌 '진행 중'을 가리킬 때), active

**Mastery**:
한 Exam에서 마지막에 정답으로 맞힌 문항의 비율. Progress에서 파생되는 학습도 지표.
_Avoid_: score(점수는 한 Session의 결과), accuracy

**Wrong-list (오답노트)**:
현재 오답으로 추적되는 문항 집합. 틀리면 자동 편입되고, 이후 맞히면 빠진다. Progress의 일부이자 하나의 학습 모드.
_Avoid_: mistakes, failures
