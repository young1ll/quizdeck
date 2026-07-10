import React from "react";

// 로그인·admin 브랜딩 (ADR-0024 확장 E) — 자산 의존 없는 텍스트 워드마크(favicon·이미지 파이프라인
// 없이 브랜딩만). graphics.Logo = 로그인 화면 큰 로고.
export default function Logo() {
  return (
    <span style={{ fontSize: "2rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
      🎯 QuizDeck <span style={{ fontWeight: 400, opacity: 0.6 }}>CMS</span>
    </span>
  );
}
