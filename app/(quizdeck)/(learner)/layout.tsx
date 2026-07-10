import { HeaderSlotProvider } from "@/lib/header-slot";
import LearnerHeader from "@/components/LearnerHeader";
import NoticeBanner from "@/components/NoticeBanner";
import { getSiteConfigCms } from "@/cms/serve";

// (learner) 섹션 shell (ADR-0010 결정 2·7 · ADR-0012 결정 6). 적응형 단일 헤더 — 기본은 QuizDeck+계정,
// exam 안에선 ExamHeaderBinder 가 슬롯을 시험 맥락(‹코드·🔎검색·계정)으로 채운다. HeaderSlotProvider 는
// 헤더와 children(=exam 섹션의 바인더) 위에 있어 안쪽이 바깥 헤더를 채울 수 있다. 본문 폭은 각 페이지가
// Container 로 잡는다(home 은 넓게·/me 는 좁게). 서버 컴포넌트 유지 — 클라 provider/헤더만 client.
// 공지 배너(확장 D)는 CMS 사이트 설정 — Global afterChange 가 루트 layout 을 revalidate 해
// ISR(exam) 경로에도 저장 즉시 반영된다.
export default async function LearnerLayout({ children }: { children: React.ReactNode }) {
  const site = await getSiteConfigCms();
  return (
    <HeaderSlotProvider>
      <div className="min-h-dvh">
        {site.notice.enabled && <NoticeBanner text={site.notice.text} tone={site.notice.tone} />}
        <LearnerHeader />
        {children}
      </div>
    </HeaderSlotProvider>
  );
}
