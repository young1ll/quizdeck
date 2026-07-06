import type { Annotation } from "./annotation";

// 로컬 주석 캐시 (아키텍처 리뷰 annotation-sync). 서버가 권위이지만, 그동안 주석은 React state 에만
// 있어 **새로고침·오프라인이면 사라졌다**(progress 는 localStorage 미러가 있는데 주석은 없었다).
// 이 캐시는 로드된 주석을 (Learner, Exam)별로 미러링해 즉시 복원한다 — 새로고침·오프라인 생존.
//
// progress 의 composite(LWW·retry)와 달리 이건 **write-through 미러**일 뿐이다: 로드는 server-wins
// (온라인이면 서버가 캐시를 덮는다), write 는 여전히 best-effort(어댑터가 소유, 훅이 swallow). 즉
// 오프라인에서 *만든* 주석은 다음 온라인 로드가 덮어 사라질 수 있다(재전송 큐는 option C — 미도입).
// 주석은 2차 표시라 그 상한을 수용한다(ADR-0016). 동기 계약이라 마운트 첫 페인트에 캐시를 바로 쓴다.
//
// 키에 learnerId 를 넣어 **기기 공유 시 계정 간 노출을 막는다** — 다른 Learner 로 로그인해도 자기
// 캐시만 읽는다(progress localStorage 키보다 엄격).

export interface AnnotationCache {
  read(learnerId: string, exam: string): Annotation[];
  write(learnerId: string, exam: string, items: Annotation[]): void;
}

/** 테스트·임시용 인메모리 캐시 */
export function inMemoryAnnotationCache(): AnnotationCache {
  const m = new Map<string, Annotation[]>();
  const key = (l: string, e: string) => `${l}::${e}`;
  return {
    read: (l, e) => m.get(key(l, e)) ?? [],
    write: (l, e, items) => {
      m.set(key(l, e), items);
    },
  };
}

const KEY_PREFIX = "quizdeck:annotations:";

/**
 * 기본 어댑터. Storage 는 지연 해석(기본 window.localStorage)이라 SSR-safe 하다 — 팩토리는 window 를
 * 만지지 않고, read/write(클라이언트 실행 시점)에서만 접근한다. 없으면(SSR·차단) 조용히 no-op/빈배열.
 * 테스트는 fake Storage 를 주입한다.
 */
export function localAnnotationCache(storage?: Storage): AnnotationCache {
  const get = (): Storage | null => {
    if (storage) return storage;
    try {
      return typeof window !== "undefined" ? window.localStorage : null;
    } catch {
      return null;
    }
  };
  const key = (l: string, e: string) => `${KEY_PREFIX}${l}::${e}`;
  return {
    read(learnerId, exam) {
      const s = get();
      if (!s) return [];
      try {
        const raw = s.getItem(key(learnerId, exam));
        const data = raw ? JSON.parse(raw) : [];
        return Array.isArray(data) ? (data as Annotation[]) : [];
      } catch {
        return [];
      }
    },
    write(learnerId, exam, items) {
      const s = get();
      if (!s) return;
      try {
        s.setItem(key(learnerId, exam), JSON.stringify(items));
      } catch {
        /* quota·차단 등은 무시 — 캐시는 best-effort */
      }
    },
  };
}
