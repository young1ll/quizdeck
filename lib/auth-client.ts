"use client";

import { createAuthClient } from "better-auth/react";
import { dashClient } from "@better-auth/infra/client";

// 같은 오리진 — baseURL 생략 시 현재 오리진(`/api/auth`) 기준으로 호출한다.
// 세션 쿠키가 같은 오리진이라 fetch 에 자동 포함된다. (이슈 #6: 같은 오리진 쿠키 세션)
//
// dashClient — 서버 dash() 플러그인의 클라이언트 짝. 대시보드 연동에 필요한
// 클라이언트 액션($Infer 등)을 authClient 에 추가한다.
export const authClient = createAuthClient({
  plugins: [dashClient()],
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
} = authClient;
