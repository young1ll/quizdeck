"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { isLearner } from "@/lib/learner";
import AuthForms from "@/components/AuthForms";

// 로그인 라우트 (ADR-0010 결정 3, 슬라이스 C). (auth) 레이아웃이 mobile-first 풀스크린 중앙정렬을
// 제공한다 — home·shell 헤더의 "로그인"이 여기로 온다. 연습 게이트는 별개 모달(in-context, 학습
// 상태 보존). AuthForms 는 로그인 성공 시 useSession 만 갱신하므로 여기서 검증되면 home 으로 보낸다
// (가입은 "메일 확인" 안내로 끝나 세션이 없어 머문다).
export default function LoginPage() {
  const { data: session } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (isLearner(session)) router.replace("/");
  }, [session, router]);
  return <AuthForms />;
}
