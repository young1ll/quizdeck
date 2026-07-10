import React from "react";
import Link from "next/link";
import type { ServerProps } from "payload";
import { isAdminRole } from "../../lib/admin.ts";

// nav '사용자' 링크 (확장 B) — admin 에게만 노출(author 는 뷰 자체도 거부하지만 진입점부터 숨김).
export default function UsersNavLink({ user }: ServerProps) {
  if (!isAdminRole((user as { role?: string } | null)?.role)) return null;
  return (
    <Link href="/admin/users" style={{ display: "block", padding: "0.25rem 0", fontSize: "0.9rem" }}>
      👥 사용자
    </Link>
  );
}
