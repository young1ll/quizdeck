import Concepts from "@/components/views/Concepts";
import BackToHub from "@/components/BackToHub";

// 개념 참조 라우트 (ADR-0010 슬라이스 B). ?seed = 다른 화면(서비스맵 openConceptFor)에서 넘어온 검색어.
// `await searchParams` 는 동적 API라 정적 프리렌더(layout 의 generateStaticParams=ISR)와 충돌해
// 런타임 static→dynamic 에러(500)를 낸다 — seed 가 필요한 페이지이므로 동적 렌더로 명시한다.
export const dynamic = "force-dynamic";

export default async function ConceptsPage({
  searchParams,
}: {
  searchParams: Promise<{ seed?: string }>;
}) {
  const { seed } = await searchParams;
  return (
    <>
      <BackToHub />
      <Concepts initialSeed={seed ?? ""} />
    </>
  );
}
