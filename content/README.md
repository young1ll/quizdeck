# content/ — 시험별 학습 데이터 레이어

Phase 0에서 기존 `index.html`에 임베드돼 있던 JSON `<script>` 블록을 시험별 독립 파일로 분리한 것이다.
멀티 시험(AWS, CNCF, Cisco …) 확장을 위한 데이터 규약을 정의한다.

## 디렉토리 규약

```
content/<provider>/<exam-slug>/
  meta.json       # 시험 식별 정보 + 카운트
  questions.json  # 문항
  concepts.json   # 개념/서비스 용어집
  q2svc.json      # 문항 → 관련 서비스 매핑
  icons.json      # 서비스 → 아이콘(base64 SVG)
  diagrams.json   # 참고 아키텍처 다이어그램(inline SVG)
```

새 시험 추가 = 위 구조로 폴더 하나 추가. 예) `content/cncf/cka/`, `content/cisco/ccna/`.

## 파일별 스키마

### meta.json
```json
{ "provider": "aws", "providerName": "...", "code": "SAP-C02",
  "name": "...", "slug": "sap-c02", "language": "ko",
  "counts": { "questions": 647, "concepts": 174, "diagrams": 22 } }
```

### questions.json — `list[{...}]`
| 키 | 의미 |
|---|---|
| `qn` | 문항 번호 |
| `topic` | 주제(이모지 포함 라벨) |
| `q` | 문제 본문 |
| `options` | 보기 배열 |
| `answer` | 정답 배열(복수 정답 가능, 예: `["A","D","F"]`) |
| `explanation` | 해설 |
| `tip` | 보조 팁 |
| `page` | 참고 페이지/출처 |
| `deeplink` | 외부 참고 링크 |

### concepts.json — `list[{...}]`
`svc`(서비스명), `abbr`, `cat`(분류), `deff`(정의), `detail`, `cost`, `key`,
`rel`/`reln`(관계), `trap`(함정), `vs`(비교), `when`(사용 시점).

### q2svc.json — `dict{ "<qn>": ["서비스명", ...] }`
문항 번호 → 관련 AWS 서비스명 배열. `concepts.json`/`icons.json`의 `svc` 키와 연결.

### icons.json — `dict{ "<서비스명>": "data:image/svg+xml;base64,..." }`
서비스명 → 아이콘. *(향후 개별 SVG 파일로 외부화 검토 — 현재 base64 인라인)*

### diagrams.json — `list[{ id, title, cat, caption, svg }]`
`svg`는 인라인 SVG 마크업.

## 출처
`index.html`의 `<script id="quizdata|conceptdata|q2svcdata|icondata|diagdata" type="application/json">`
블록에서 1:1 추출(무손실). 추출 후 전수 JSON 파싱 검증 완료.
