import type { ContentCommand } from "./content-command";

// ContentCommand 클라 sender (아키텍처 리뷰 C2). 와이어 = command 그대로 전송하고 HTTP 메서드는
// kind 에서 파생한다(upsert→PUT, delete→DELETE — C1 자기기술 kind). 그동안 ContentEditor 가 putContent·
// delContent 두 함수로 이원화하던 것을 하나로 합친다. 세션 쿠키(같은 오리진)는 credentials 로 동반된다.
// 훅(use-question-draft·use-concept-draft)이 이걸 주입받아(기본값) 부르므로 테스트는 fake 를 넣는다.

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function sendContentCommand(cmd: ContentCommand): Promise<Response> {
  const method = cmd.kind.startsWith("upsert") ? "PUT" : "DELETE";
  return fetch(`${BASE_PATH}/api/admin/content`, {
    method,
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(cmd),
  });
}
