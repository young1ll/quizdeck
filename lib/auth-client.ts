"use client";

import { createAuthClient } from "better-auth/react";

// 같은 오리진 — baseURL 생략 시 현재 오리진(`/api/auth`) 기준으로 호출한다.
// 세션 쿠키가 같은 오리진이라 fetch 에 자동 포함된다. (이슈 #6: 같은 오리진 쿠키 세션)
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;
