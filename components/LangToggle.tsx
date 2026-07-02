"use client";

import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { useLang } from "@/lib/lang-context";
import { LANG_LABEL } from "@/lib/content-localize";

// 언어 토글 (이슈 #28 / ADR-0005 C) — astryx SegmentedControl 래퍼 (ADR-0014 Phase 2). 가용 언어가
// 2개 이상일 때만 보인다(1개면 숨김). 전환은 표시 언어만 바꾼다 — qn·정답·Progress 는 그대로(언어 무관).
// 상호배타 토글이라 SegmentedControl 이 시맨틱 정합(선택 상태·키보드·ARIA 내장). setLang 은 string 이라
// 캐스트 불필요. mb-3 여백은 폼 레이아웃용으로 유지(Tailwind 공존).
export default function LangToggle() {
  const { lang, setLang, available } = useLang();
  if (available.length < 2) return null;

  return (
    <div className="mb-3">
      <SegmentedControl value={lang} onChange={setLang} label="표시 언어" size="sm">
        {available.map((l) => (
          <SegmentedControlItem key={l} value={l} label={LANG_LABEL[l] ?? l.toUpperCase()} />
        ))}
      </SegmentedControl>
    </div>
  );
}
