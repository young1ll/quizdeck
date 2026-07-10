-- 구 콘텐츠 저장소 폐기 (ADR-0024 4단계). 서빙은 3단계(sha-e6a9861)부터 payload 스키마 —
-- 이 테이블들을 읽는 코드는 4단계 PR 이 전부 제거했다(구 로더·이관/검증 스크립트·seed).
-- ⚠️ 다른 마이그레이션과 순서가 반대다: **4단계 앱 배포가 라이브 확인된 뒤** 적용한다
--    (선적용하면 혹시 남은 구 이미지가 500 — 후적용은 어느 시점에도 무해).
-- 복구: R2 야간 백업(ADR-0021) 또는 payload 스키마에서 역이관.
drop table "question";
drop table "concept";
drop table "exam_icon_override";
