# 0023 — 아이콘: 컬렉션 필드 + 문제집 admin 오버라이드

- 상태: Accepted — 2026-07-10 (사용자 결정: "admin UI + DB 오버라이드", "프리셋 팔레트 + 직접 입력")
- 관련: [[0005-content-in-db.md|ADR-0005]](카탈로그 = 파일·빌드-세이프 — 부분 오버레이) · [[0022-collection-curated-cross-exam.md|ADR-0022]](컬렉션 엔티티)
- 코드: `db/migrations/0009_icons.sql` · `lib/catalog.ts`(parseIcon·applyIconOverrides) · `lib/exam-icon-db.ts` · `app/api/admin/exam-icon/route.ts` · `components/ui/IconPicker.tsx`

## 맥락

문제집(Exam) 아이콘은 데이터 모델 개선 ②에서 `meta.json` 필드로 도입됐다(파일 소유 — 수정 = 커밋+배포). 컬렉션은 아이콘이 없었다. 사용자가 둘 다 **앱 안에서 추가/수정**을 요구했다.

## 결정

1. **컬렉션 아이콘 = 엔티티 필드.** `collection.icon` 컬럼(0009) — Learner 소유 엔티티라 컬럼 추가로 끝. `parseCollection` 이 경계 검증(name 과 같은 strict — 불량이면 전체 거부), 생성/상세에서 편집(빈 값 저장 = 제거).
2. **문제집 아이콘 = DB 오버라이드 최소 오버레이.** 카탈로그(`listExams`)는 파일 meta·빌드-세이프(ADR-0005 A)를 **그대로 유지**하고, `exam_icon_override(exam_key pk, icon)` 행을 표시 직전에 얹는다 — 행 존재 = 오버라이드, 행 삭제 = 파일 기본값 복귀. 카탈로그 전체의 DB 이관은 하지 않는다(재개봉 아님 — 아이콘 한 필드만).
3. **병합은 순수 이음새.** `applyIconOverrides(exams, overrides)`(lib/catalog, 순수·핀됨) — 소비 RSC(home·/me·컬렉션 상세/quiz·admin 콘텐츠)가 `loadIconOverrides(pool)` 후 적용. **전 소비처가 force-dynamic** 이라 ISR revalidate 불요(admin 저장 즉시 반영).
4. **검증 공유.** `parseIcon`(trim, ≤16 UTF-16 유닛 — ZWJ 조합 이모지 수용) 하나를 컬렉션·오버라이드 API 가 공유. 오버라이드 API 는 examKey 를 카탈로그 실존 시험으로 제한(임의 키 행 방지).
5. **UI = 공용 IconPicker.** 프리셋 팔레트(16) + 직접 입력 — 컬렉션 생성/상세 편집·admin 문제집 편집이 같은 컴포넌트.

## 기각 대안 (재제안 방지)

- **exam 메타 전체 DB 이관** — 아이콘 하나 때문에 카탈로그의 빌드-세이프 속성(ADR-0005 A)과 seed 파이프라인을 재설계하는 건 과대. 오버레이로 충분.
- **meta.json 수정 유지(현행)** — 재배포 없는 수정 불가. 사용자가 admin 런타임 수정을 명시 선택.
- **learner별 문제집 아이콘 커스텀** — 아이콘은 카탈로그 표시 속성(전역)이지 개인 설정이 아니다. 스코프 밖.

## 결과

- 새 테이블 1 + 컬럼 1(0009 — **앱 배포 전 선적용**, 0005/0007/0008 선례) · 새 admin API 1(withAdmin).
- 카탈로그가 "파일 전용"에서 "파일 + 아이콘 오버레이"로 — listExams 자체는 여전히 동기·파일·빌드-세이프.

## 애던덤 — 문제집 아이콘 이미지 파일 (2026-07-10)

- 코드: `db/migrations/0010_exam_icon_image.sql` · `lib/icon-image.ts`(parseIconImage) · `app/api/exam-icon/[provider]/[slug]/route.ts`(공개 서빙) · `components/ui/ExamIcon.tsx`

1. **오버라이드 = 이모지 또는 이미지(XOR).** `exam_icon_override` 에 `image bytea + mime` 추가, 행당 둘 중 하나만(0010 check 제약). 이미지는 **DB 저장** — 컨테이너 FS 는 휘발, 오브젝트 스토리지는 아이콘 몇 개(≤256KB)에 과대.
2. **병합 배관 무변경.** `loadIconOverrides` 가 이미지 행을 서빙 URL 문자열(`/api/exam-icon/<key>/?v=<updated_at>`)로 돌려줘 `applyIconOverrides`·표시 배관이 문자열 하나로 유지. 렌더 분기는 `<ExamIcon>` 하나가 소유("/" 시작 = `<img>`, 아니면 이모지 span).
3. **서빙 = 공개 GET + immutable 캐시.** 카탈로그(home)가 익명 공개라 아이콘도 공개. `?v=` 로 URL 이 교체 시마다 바뀌어 `max-age=31536000, immutable` 안전. SVG 스크립트는 `<img>` 렌더(원래 inert) + `nosniff` + `CSP default-src 'none'`(직접 내비게이션)으로 무력화.
4. **업로드 경계.** admin PUT 에 `{imageBase64, mime}` 변형(256KB 캡이라 JSON 봉투 충분). 순수 `parseIconImage` 가 mime 화이트리스트(png/jpeg/webp/gif/svg) + 크기 캡 + **매직 바이트**(svg 는 루트 태그)로 mime-내용 불일치를 거부.
5. **기각 — data URI 인라인**: 서빙 라우트 없이 base64 를 HTML 에 임베드. 페이지마다 아이콘 바이트가 SSR 페이로드에 중복되고 캐시 불가. 라우트 서빙 채택.
6. **컬렉션 아이콘은 이모지 유지** — 요구 스코프가 문제집만, parseCollection(≤16 유닛)이 URL 을 구조적으로 거부.
