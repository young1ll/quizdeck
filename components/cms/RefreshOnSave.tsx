"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshRouteOnSave } from "@payloadcms/live-preview-react";

// 라이브 프리뷰 갱신 다리 (ADR-0024 2차 확장 A). admin iframe 안에서 렌더될 때 Payload 가
// 저장/autosave 마다 postMessage 를 보내고, 이 컴포넌트가 RSC 라우터를 refresh 해 서버가
// draft 를 다시 읽는다(server-side live preview 패턴). origin 은 same-origin 검증용 —
// SSR 엔 window 가 없어 마운트 후에만 렌더한다.
export default function RefreshOnSave() {
  const router = useRouter();
  const [origin, setOrigin] = useState<string>();
  useEffect(() => setOrigin(window.location.origin), []);
  if (!origin) return null;
  return <RefreshRouteOnSave refresh={() => router.refresh()} serverURL={origin} />;
}
