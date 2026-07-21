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
//
// wp-admin SSO(ADR-0028): oauth-provider 가 미로그인 authorize 요청을 서명된 재개 파라미터와
// 함께 여기로 보낸다. 로그인되면 원 쿼리 그대로 authorize 로 복귀해야 코드 발급이 재개된다 —
// 홈으로 보내면 flow 가 유실된다. API 라우트라 풀 내비게이션(window.location). 쿼리는 effect
// 에서 window 로 읽는다(useSearchParams 는 정적 페이지에 Suspense 요구 — 불필요한 구조 변경).
export default function LoginPage() {
  const { data: session } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (!isLearner(session)) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("client_id") && params.get("response_type")) {
      window.location.replace(`/api/auth/oauth2/authorize?${params.toString()}`);
      return;
    }
    router.replace("/");
  }, [session, router]);
  return <AuthForms />;
}
