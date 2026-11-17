import { getClient, ApiError } from "./supabase";
import {
  listInterviewWorklist,
  type InterviewStatus,
  type InterviewWorklistItem,
} from "./interviews";
import { offerWorkflow, type WorkflowOffer } from "./offer-approval";

export const HOME_PAGE_SIZE = 100;
/** Never publish a truncated result as an exact total. A broken/repeating page fails closed. */
export async function collectPages<T extends { id: string }>(
  read: (limit: number, offset: number) => Promise<T[]>,
  current = () => true,
): Promise<T[]> {
  const rows = new Map<string, T>();
  for (let offset = 0; offset <= 100000; offset += HOME_PAGE_SIZE) {
    if (!current()) throw new Error("HOME_REQUEST_CANCELLED");
    const page = await read(HOME_PAGE_SIZE, offset);
    if (!current()) throw new Error("HOME_REQUEST_CANCELLED");
    if (
      !Array.isArray(page) ||
      page.length > HOME_PAGE_SIZE ||
      page.some((x) => !x || typeof x.id !== "string")
    )
      throw new Error("HOME_INVALID_PAGE");
    if (offset > 0 && page.some((row) => rows.has(row.id)))
      throw new Error("HOME_PAGE_CHANGED");
    let added = 0;
    for (const row of page) {
      if (!rows.has(row.id)) added++;
      rows.set(row.id, row);
    }
    if (page.length < HOME_PAGE_SIZE) return [...rows.values()];
    if (!added) throw new Error("HOME_REPEATING_PAGE");
  }
  throw new Error("HOME_RESULT_TOO_LARGE");
}
export const allInterviews = (
  status: InterviewStatus,
  current?: () => boolean,
) =>
  collectPages(
    (limit, offset) => listInterviewWorklist(status, limit, offset),
    current,
  );
export const allHomeOffers = (current?: () => boolean) =>
  collectPages<WorkflowOffer>(
    (limit, offset) => offerWorkflow({ action: "list", limit, offset }),
    current,
  );
export type RecruitmentTask = {
  id: string;
  title: string;
  status: "OPEN" | "COMPLETED" | "CANCELLED";
  priority: string;
  due_at: string | null;
  job_id: string | null;
  application_id: string | null;
  candidate_id: string | null;
  created_at: string;
  completed_at: string | null;
  owner_id?: string;
  created_by?: string;
};
export type TaskDetail = {
  task: RecruitmentTask & { owner_id: string; created_by: string };
  events: {
    id: string;
    actor_id: string;
    event_type: string;
    created_at: string;
  }[];
};
export async function taskCall<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await getClient().functions.invoke("tasks", { body });
  if (error)
    throw new ApiError(
      "Unable to load or update tasks.",
      error.context?.status,
    );
  if (data?.error) throw new ApiError(String(data.error), data.status);
  if (!data || typeof data !== "object")
    throw new Error("HOME_INVALID_TASK_RESPONSE");
  return data as T;
}
export const allMyTasks = (current?: () => boolean) =>
  collectPages<RecruitmentTask>(async (limit, offset) => {
    const r = await taskCall<{ tasks: RecruitmentTask[] }>({
      action: "list",
      status: "OPEN",
      limit,
      offset,
    });
    if (!Array.isArray(r.tasks)) throw new Error("HOME_INVALID_TASK_RESPONSE");
    return r.tasks;
  }, current);
export const HOME_TIME_ZONE = "Asia/Ho_Chi_Minh";
export function localDay(value: string | number | Date): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: HOME_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
export function todaysInterviews(rows: InterviewWorklistItem[], now: number) {
  const today = localDay(now);
  return rows
    .filter((x) => localDay(x.starts_at) === today)
    .sort(
      (a, b) =>
        Date.parse(a.starts_at) - Date.parse(b.starts_at) ||
        a.id.localeCompare(b.id),
    );
}
export function safeMeetingUrl(value: string | null) {
  if (!value) return null;
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password
      ? u.href
      : null;
  } catch {
    return null;
  }
}
export function interviewKind(type: string, en: boolean) {
  return (
    (
      {
        PHONE_SCREEN: en ? "Phone screen" : "Sơ vấn",
        INTERVIEW: en ? "Interview" : "Phỏng vấn",
        FINAL: en ? "Final interview" : "Phỏng vấn cuối",
      } as Record<string, string>
    )[type] || type
  );
}
