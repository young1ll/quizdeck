-- 문제집 아이콘 이미지 (ADR-0023 애던덤). 오버라이드가 이모지(icon) 또는 **이미지 파일**(image+mime,
-- png/svg/jpeg/webp/gif ≤256KB — 경계 검증은 lib/icon-image.parseIconImage)을 담는다. 한 행은 둘 중
-- 하나만(XOR 제약) — 표시 경로가 문자열 하나(이모지 or 서빙 URL)로 남아 병합(applyIconOverrides)이
-- 무변경. 이미지는 DB 저장(bytea) — 컨테이너 FS 는 휘발이고 오브젝트 스토리지는 아이콘 몇 개에 과대.
alter table "exam_icon_override" alter column "icon" drop not null;
alter table "exam_icon_override"
  add column "image" bytea,
  add column "mime"  text;
alter table "exam_icon_override"
  add constraint "exam_icon_override_kind" check (
    ("icon" is not null and "image" is null and "mime" is null)
    or ("image" is not null and "mime" is not null and "icon" is null)
  );
