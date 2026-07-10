import type { IconType } from "react-icons";
import {
  LuGraduationCap,
  LuBrain,
  LuTimer,
  LuRepeat2,
  LuStar,
  LuFolderOpen,
  LuStickyNote,
  LuLayers,
} from "react-icons/lu";
import type { Mode } from "@/lib/store";

// 학습 모드 아이콘 — Lucide(ADR-0009 · 이모지 통일). Home 허브·Setup 이 공유(중복 제거).
// study=졸업모/smart=뇌/exam=타이머/wrong=반복/star=별/mine=폴더/memo=메모.
export const MODE_ICON: Record<Mode, IconType> = {
  study: LuGraduationCap,
  smart: LuBrain,
  exam: LuTimer,
  wrong: LuRepeat2,
  star: LuStar,
  mine: LuFolderOpen,
  memo: LuStickyNote,
  collection: LuLayers, // 컬렉션 혼합 풀기(ADR-0022 S2)
};
