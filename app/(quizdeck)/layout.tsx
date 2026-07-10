import type { Metadata, Viewport } from "next";
import "../globals.css";
import InAppBrowserBanner from "@/components/InAppBrowserBanner";
import AstryxProvider from "@/components/AstryxProvider";

export const metadata: Metadata = {
  title: "QuizDeck — 자격 시험 학습",
  description: "Self-hosted exam quiz app for certification prep",
  appleWebApp: {
    capable: true,
    title: "QuizDeck",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f1419",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" data-theme="dark">
      <body className="min-h-dvh">
        <AstryxProvider>
          <InAppBrowserBanner />
          {children}
          {/* PDF 내보내기(window.print) 전용 영역 — 화면에선 숨김 */}
          <div id="printarea" aria-hidden />
        </AstryxProvider>
      </body>
    </html>
  );
}
