"use client";

import { createAuthClient } from "better-auth/react";
import { passkeyClient } from "@better-auth/passkey/client";
import { dashClient } from "@better-auth/infra/client";

// 같은 오리진 — baseURL 생략 시 현재 오리진(`/api/auth`) 기준으로 호출한다.
// 세션 쿠키가 같은 오리진이라 fetch 에 자동 포함된다. (이슈 #6: 같은 오리진 쿠키 세션)
//
// dashClient — 서버 dash() 플러그인의 클라이언트 짝. 대시보드 연동에 필요한
// 클라이언트 액션($Infer 등)을 authClient 에 추가한다.
// passkeyClient — 서버 passkey() 짝(V5 / 이슈 #10). signIn.passkey(비번 없는 로그인) +
// passkey.addPasskey/listUserPasskeys/deletePasskey(등록·조회·삭제)를 authClient 에 더한다.
export const authClient = createAuthClient({
  plugins: [dashClient(), passkeyClient()],
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  // 이메일 인증·비밀번호 재설정 (ADR-0004 / 이슈 #21)
  sendVerificationEmail,
  requestPasswordReset,
  resetPassword,
  // 마이페이지 계정 관리 (ADR-0006 / 이슈 #36)
  updateUser,
  changePassword,
  deleteUser,
  // 이메일 변경 (ADR-0006 / 이슈 #38)
  changeEmail,
  // 패스키 (V5 / 이슈 #10) — signIn.passkey 는 위 signIn 에 포함. passkey.* 는 등록·관리.
  passkey,
} = authClient;
