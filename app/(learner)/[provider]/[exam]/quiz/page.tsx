import QuizFlow from "@/components/views/QuizFlow";
import { parseQnSet } from "@/lib/collection";

// 퀴즈 플로 라우트 (ADR-0010 슬라이스 B2). 본문은 QuizFlow(클라이언트) — 여기는 컬렉션 딥엔트리
// ?set=7,20,… (ADR-0022 S1.5)을 서버에서 읽어 넘기는 얇은 래퍼다. `await searchParams` 는 동적 API라
// 정적 프리렌더와 충돌 → 동적 렌더 명시(concepts ?seed 선례).
export const dynamic = "force-dynamic";

export default async function QuizFlowPage({
  searchParams,
}: {
  searchParams: Promise<{ set?: string }>;
}) {
  const { set } = await searchParams;
  return <QuizFlow initialSet={parseQnSet(set)} />;
}
