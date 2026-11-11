// src/lib/homeworkContract.ts
// Öğretmen Ödev Paketi URL Üretici, Çözümleyici ve localStorage İlerleme Sözleşmesi

export interface HomeworkContractInput {
  contentId: string;
  listen: boolean;
  pronTargetCount: number;
  quiz: boolean;
  title?: string;
}

export interface ParsedHomeworkParams {
  active: boolean;
  listen: boolean;
  pronTargetCount: number;
  quiz: boolean;
  title: string;
  aid: string;
}

export interface PersistedHomeworkProgress {
  listened: number[];
  practicedLines: number[];
  pronCount: number;
  scores: number[];
  quizDone: boolean;
  updatedAt: number;
}

export function computeAssignmentHash(input: HomeworkContractInput): string {
  const normalizedTitle = (input.title || "").trim().slice(0, 140);
  const canonical = `${input.contentId}|L:${input.listen ? 1 : 0}|P:${Math.max(
    0,
    Math.floor(input.pronTargetCount)
  )}|Q:${input.quiz ? 1 : 0}|T:${normalizedTitle}`;

  let hash = 2166136261;
  for (let i = 0; i < canonical.length; i++) {
    hash ^= canonical.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).slice(0, 7).padStart(5, "0");
}

export function buildHomeworkSearchParams(
  input: HomeworkContractInput
): URLSearchParams {
  const params = new URLSearchParams();
  const safePronCount = Math.max(0, Math.floor(input.pronTargetCount || 0));
  const trimmedTitle = (input.title || "").trim().slice(0, 140);
  const aid = computeAssignmentHash({
    ...input,
    pronTargetCount: safePronCount,
    title: trimmedTitle,
  });

  params.set("hw", "1");
  params.set("listen", input.listen ? "1" : "0");
  params.set("pron", String(safePronCount));
  params.set("quiz", input.quiz ? "1" : "0");
  if (trimmedTitle) {
    params.set("title", trimmedTitle);
  }
  params.set("aid", aid);
  return params;
}

export function buildHomeworkUrl(
  baseOrigin: string,
  input: HomeworkContractInput
): string {
  const cleanOrigin = (baseOrigin || "https://app.muallimun.net").replace(
    /\/+$/,
    ""
  );
  const routeSegment = input.contentId.startsWith("metin_")
    ? "metin"
    : "diyalog";
  const params = buildHomeworkSearchParams(input);
  return `${cleanOrigin}/${routeSegment}/${input.contentId}?${params.toString()}`;
}

export function parseHomeworkParams(
  searchInput:
    | URLSearchParams
    | string
    | Record<string, string | string[] | undefined>
    | null
    | undefined,
  fallbackContentId = "default"
): ParsedHomeworkParams {
  let sp: URLSearchParams;
  if (!searchInput) {
    sp = new URLSearchParams();
  } else if (searchInput instanceof URLSearchParams) {
    sp = searchInput;
  } else if (typeof searchInput === "string") {
    const q = searchInput.startsWith("?") ? searchInput.slice(1) : searchInput;
    sp = new URLSearchParams(q);
  } else {
    sp = new URLSearchParams();
    for (const [k, v] of Object.entries(searchInput)) {
      if (typeof v === "string") {
        sp.set(k, v);
      } else if (Array.isArray(v) && v.length > 0 && typeof v[0] === "string") {
        sp.set(k, v[0]);
      }
    }
  }

  const active = sp.get("hw") === "1";
  const listenRaw = sp.get("listen");
  const listen = listenRaw === null ? true : listenRaw !== "0";

  const pronRaw = sp.get("pron");
  let pronTargetCount = 3;
  if (pronRaw !== null) {
    const parsedInt = parseInt(pronRaw, 10);
    pronTargetCount = Number.isFinite(parsedInt) ? Math.max(0, parsedInt) : 0;
  }

  const quizRaw = sp.get("quiz");
  const quiz = quizRaw === null ? true : quizRaw !== "0";

  const title = (sp.get("title") || "").trim().slice(0, 140);
  const explicitAid = (sp.get("aid") || "").trim();
  const aid =
    explicitAid ||
    computeAssignmentHash({
      contentId: fallbackContentId,
      listen,
      pronTargetCount,
      quiz,
      title,
    });

  return {
    active,
    listen,
    pronTargetCount,
    quiz,
    title,
    aid,
  };
}

export function getHomeworkStorageKey(contentId: string, aid: string): string {
  const safeAid = (aid || "default").replace(/[^a-zA-Z0-9_-]/g, "");
  return `muallimun-hw-v2-${contentId}-${safeAid || "default"}`;
}

export function loadHomeworkProgress(
  contentId: string,
  aid: string
): PersistedHomeworkProgress | null {
  if (typeof window === "undefined") return null;
  const key = getHomeworkStorageKey(contentId, aid);
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedHomeworkProgress>;
    const listened = Array.isArray(parsed.listened)
      ? Array.from(
          new Set(
            parsed.listened.filter(
              (n): n is number => typeof n === "number" && Number.isFinite(n)
            )
          )
        )
      : [];
    const practicedLines = Array.isArray(parsed.practicedLines)
      ? Array.from(
          new Set(
            parsed.practicedLines.filter(
              (n): n is number => typeof n === "number" && Number.isFinite(n)
            )
          )
        )
      : [];
    const scores = Array.isArray(parsed.scores)
      ? parsed.scores.filter(
          (n): n is number =>
            typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 100
        )
      : [];
    const pronCount = Math.max(
      practicedLines.length,
      typeof parsed.pronCount === "number" && Number.isFinite(parsed.pronCount)
        ? Math.max(0, parsed.pronCount)
        : 0
    );

    return {
      listened,
      practicedLines,
      pronCount,
      scores,
      quizDone: Boolean(parsed.quizDone),
      updatedAt:
        typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

export function saveHomeworkProgress(
  contentId: string,
  aid: string,
  progress: Omit<PersistedHomeworkProgress, "updatedAt">
): void {
  if (typeof window === "undefined") return;
  const key = getHomeworkStorageKey(contentId, aid);
  try {
    const payload: PersistedHomeworkProgress = {
      ...progress,
      updatedAt: Date.now(),
    };
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // ignore quota errors
  }
}

export function clearStudentDeviceData(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem("muallimun_student_name");
    window.localStorage.removeItem("muallimun_student_class");

    const localKeysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && (k.startsWith("muallimun-hw-") || k.startsWith("muallimun_student_"))) {
        localKeysToRemove.push(k);
      }
    }
    for (const k of localKeysToRemove) {
      window.localStorage.removeItem(k);
    }
  } catch {
    // ignore
  }

  try {
    const sessionKeysToRemove: string[] = [];
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const k = window.sessionStorage.key(i);
      if (k && k.startsWith("muallimun-hw-")) {
        sessionKeysToRemove.push(k);
      }
    }
    for (const k of sessionKeysToRemove) {
      window.sessionStorage.removeItem(k);
    }
  } catch {
    // ignore
  }
}
