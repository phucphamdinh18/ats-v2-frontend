export type Kind = "cv" | "jd";
export type ReviewState = "pending_review" | "approved" | "rejected";
export type Job = {
  id: string;
  job_code: string | null;
  title: string;
  status: string;
};
export type Draft = {
  id: string;
  review_state: ReviewState;
  full_name?: string | null;
  position?: string | null;
  email?: string | null;
  business_unit?: string | null;
  [key: string]: unknown;
};
export type Intake = {
  kind: Kind;
  state: string;
  original_name: string;
  drive_url: string | null;
};
export type Detail = {
  draft: Draft;
  intake: Intake;
  review?: { decision: string; reason: string | null } | null;
};
const fixtures: Record<Kind, { id: string; url: string }[]> = {
  cv: [
    {
      id: "a81a1a1e-287a-4ce7-9961-8b486e350c36",
      url: "https://example.invalid/ats-cv-correction-e2e-20261013.pdf",
    },
    {
      id: "30d9c99f-9f76-4e3b-be16-0a9632646df1",
      url: "https://example.invalid/ats-ta-cv-correction-e2e-20261014.pdf",
    },
  ],
  jd: [
    {
      id: "231ee8a1-ab4e-418c-85b9-32af489fd23c",
      url: "https://example.invalid/ats-correction-e2e-20261012.pdf",
    },
  ],
};
export function isCorrectionFixture(kind: Kind, detail: Detail): boolean {
  return (
    detail.intake.kind === kind &&
    detail.intake.original_name.startsWith("[TEST ONLY]") &&
    fixtures[kind].some(
      (f) => f.id === detail.draft.id && f.url === detail.intake.drive_url,
    )
  );
}
export function reviewPermissions(kind: Kind, detail: Detail) {
  const fixture = isCorrectionFixture(kind, detail);
  const pending =
    detail.draft.review_state === "pending_review" &&
    detail.intake.kind === kind;
  const ready = detail.intake.state === "ready_for_review";
  return {
    fixture,
    correct: fixture && pending && ready,
    approve: !fixture && pending && ready,
    reject: !fixture && pending,
  };
}
export function canReview(roles: string[]) {
  return roles.some((role) => role === "ADMIN" || role === "TA_RECRUITER");
}
export function driveLink(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      url.hostname === "drive.google.com" &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export function titleOf(draft: Draft) {
  return draft.full_name || draft.position || "Chưa có tên";
}
// Each request owns a ticket. Filter changes, logout and newer requests invalidate old results.
export class RequestGate {
  private revision = 0;
  next() {
    return ++this.revision;
  }
  current(ticket: number) {
    return ticket === this.revision;
  }
  invalidate() {
    ++this.revision;
  }
}

// A preview can return OAuth to the already-allowed root callback on the same origin.
// Never widen Supabase's callback allowlist just to render a preview path.
export function authRedirect(
  origin: string,
  basePath: string,
  configured?: string,
): string {
  const target = configured || origin + basePath + "/";
  const url = new URL(target);
  if (
    url.origin !== origin ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "URL đăng nhập không khớp với địa chỉ ATS. Liên hệ quản trị viên.",
    );
  }
  return url.href;
}
