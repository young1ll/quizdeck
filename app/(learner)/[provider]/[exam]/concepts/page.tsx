import Concepts from "@/components/views/Concepts";
import BackToHub from "@/components/BackToHub";

// 개념 참조 라우트 (ADR-0010 슬라이스 B). ?seed = 다른 화면(서비스맵 openConceptFor)에서 넘어온 검색어.
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
