-- better-auth admin 플러그인 스키마 (이슈 #27 / ADR-0005 B).
-- 콘텐츠 편집 권한 경계용 role + 플러그인이 요구하는 ban/impersonate 필드. 라이브러리 스키마를
-- 그대로 따른다(0001 처럼 — better-auth 가 introspect 로 요구). 기존 user 는 role NULL(=비admin).
--
-- 첫 admin 은 수동 SQL 로 지정한다(부트스트랩 — admin API 자체가 admin 을 요구하므로):
--   update "user" set "role" = 'admin' where email = '...';
alter table "user" add column "role" text;
alter table "user" add column "banned" boolean default false;
alter table "user" add column "banReason" text;
alter table "user" add column "banExpires" timestamptz;
alter table "session" add column "impersonatedBy" text;
