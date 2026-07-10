import Link from "next/link";
import React from "react";

// Payload 로그인 화면 대체 안내 (ADR-0024). 로컬 인증(비밀번호 폼)이 꺼져 있어(auth-strategy 가
// better-auth 세션만 신뢰) 기본 로그인 뷰가 비어 있다 — quizdeck 로그인으로 안내만 한다.
// 로그인 후 /cms 로 돌아오면 전략이 세션을 읽어 통과시킨다.
export default function CmsLoginLink() {
  return (
    <p style={{ textAlign: "center", marginBottom: "1rem" }}>
      CMS 는 quizdeck 계정(admin·author)으로 접근합니다.{" "}
      <Link href="/login">quizdeck 로그인 →</Link>
    </p>
  );
}
