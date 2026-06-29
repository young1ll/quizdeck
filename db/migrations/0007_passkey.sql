-- 패스키(WebAuthn) 로그인 (이슈 #10 / ADR-0003 결정 2). @better-auth/passkey 플러그인이 요구하는
-- passkey 테이블 — 라이브러리 스키마 그대로(0001 처럼 better-auth CLI generate 산출, 직접 설계 X).
-- userId 는 user(id) on delete cascade(탈퇴 시 함께 정리). credentialID 인덱스는 인증 시 자격증명
-- 조회용. createdAt 은 라이브러리 정의대로 nullable(default 없음 — 플러그인이 값을 채운다).
-- > 앱(패스키 API) 배포보다 먼저 적용해야 등록/로그인이 동작한다.
create table "passkey" ("id" text not null primary key, "name" text, "publicKey" text not null, "userId" text not null references "user" ("id") on delete cascade, "credentialID" text not null, "counter" integer not null, "deviceType" text not null, "backedUp" boolean not null, "transports" text, "createdAt" timestamptz, "aaguid" text);

create index "passkey_userId_idx" on "passkey" ("userId");

create index "passkey_credentialID_idx" on "passkey" ("credentialID");
