import config from "@payload-config";
import "@payloadcms/next/css";
import type { ServerFunctionClient } from "payload";
import { handleServerFunctions, RootLayout } from "@payloadcms/next/layouts";
import React from "react";

import { importMap } from "./cms/importMap";

// Payload admin 전용 root layout (ADR-0024). 앱 셸(app/(quizdeck)/layout.tsx)과 분리된
// 멀티 root layout — Payload 가 자체 <html>·테마·프로바이더를 소유한다(@payloadcms/next 표준).

type Args = { children: React.ReactNode };

const serverFunction: ServerFunctionClient = async function (args) {
  "use server";
  return handleServerFunctions({ ...args, config, importMap });
};

export default function PayloadLayout({ children }: Args) {
  return (
    <RootLayout config={config} importMap={importMap} serverFunction={serverFunction}>
      {children}
    </RootLayout>
  );
}
