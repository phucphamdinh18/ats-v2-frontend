import type { InterviewWorklistItem } from "./interviews";
import type { WorkflowOffer } from "./offer-approval";
import type { Job } from "./policy";
import type { JobRecruiter } from "./admin-jobs";
import type { RecruitmentTask } from "./home-data";
export type HomePerspective =
  | "ADMIN"
  | "RECRUITER"
  | "APPROVER"
  | "HIRING_MANAGER"
  | "INTERVIEWER"
  | "PERSONAL";
export function homePerspectives(
  roles: string[],
  assignedOffers: WorkflowOffer[],
): HomePerspective[] {
  const result: HomePerspective[] = [];
  if (roles.includes("ADMIN")) result.push("ADMIN");
  if (roles.includes("TA_RECRUITER")) result.push("RECRUITER");
  // Actual assignment, rather than an invented DH role, grants the approver perspective.
  if (
    assignedOffers.length ||
    roles.some((r) =>
      ["DEPARTMENT_HEAD", "DEPT_HEAD", "DH", "CEO", "APPROVER"].includes(r),
    )
  )
    result.push("APPROVER");
  if (roles.includes("HIRING_MANAGER")) result.push("HIRING_MANAGER");
  if (roles.includes("INTERVIEWER")) result.push("INTERVIEWER");
  return result.length ? result : ["PERSONAL"];
}
export type HomeTask = {
  id: string;
  group:
    "applications" | "assigned" | "feedback" | "followup" | "approval" | "job";
  title: string;
  context: string;
  owner: string;
  role: string;
  due: string | null;
  action: "task" | "interview" | "offer" | "job";
  target: string;
  job?: Job;
  priority: boolean;
};
export function jobRecruitingOwner(jobId: string, recruiters: JobRecruiter[] | undefined, en: boolean) {
 if (!recruiters) return { owner: en ? "Could not load TA assignment" : "Chưa tải được phân công TA", role: en ? "Job recruiting team" : "Nhóm TA của Job" };
 const rank = (r: JobRecruiter) => r.ta_assignment === "PRIMARY" ? 0 : r.ta_assignment === "SUPPORT" ? 1 : 2;
 const team = recruiters.filter(r => r.job_id === jobId).sort((a,b) => rank(a)-rank(b) || a.email.localeCompare(b.email));
 const label = (r: JobRecruiter) => r.ta_assignment === "PRIMARY" ? (en ? "Primary TA" : "TA chính") : r.ta_assignment === "SUPPORT" ? (en ? "Support TA" : "TA hỗ trợ") : (en ? "TA · Not classified" : "TA · Chưa phân loại");
 return {owner: team.map(r => `${r.display_name || r.email} (${label(r)})`).join("; ") || (en ? "No TA assigned" : "Chưa phân công TA"),
 role: team.some(r=>r.ta_assignment === "PRIMARY") ? (en ? "Job recruiting team" : "Nhóm TA của Job") : (en ? "Primary TA not designated" : "Chưa chỉ định TA chính")};
}
export function buildHomeTasks(input: {
  perspective: HomePerspective;
  recruiters?: JobRecruiter[];
  userId: string;
  userName: string;
  jobs: Job[];
  tasks: RecruitmentTask[];
  interviews: InterviewWorklistItem[];
  offers: WorkflowOffer[];
  en: boolean;
}): HomeTask[] {
  const {
    perspective: p,
    userId,
    userName,
    jobs,
    tasks,
    interviews,
    offers,
    en,
  } = input;
  const result: HomeTask[] = tasks.map((t) => ({
    id: `task-${t.id}`,
    group: "assigned",
    title: t.title,
    context: jobs.find((j) => j.id === t.job_id)?.title || "",
    owner: userName,
    role: en ? "Assigned to you" : "Được giao cho bạn",
    due: t.due_at,
    action: "task",
    target: t.id,
    priority: t.priority === "HIGH",
  }));
  if (["ADMIN", "RECRUITER", "HIRING_MANAGER"].includes(p))
    for (const job of jobs) {
      const count =
        p === "HIRING_MANAGER"
          ? job.metrics?.screening_count
          : job.metrics?.new_count;
      if (count && count > 0)
        result.push({
          id: `applications-${job.id}`,
          group: "applications",
          title: en
            ? `Review ${count} ${p === "HIRING_MANAGER" ? "screening" : "new"} applications`
            : `Xem ${count} hồ sơ ${p === "HIRING_MANAGER" ? "sơ loại" : "mới"}`,
          context: job.title,
          ...jobRecruitingOwner(job.id, input.recruiters, en),
          due: null,
          action: "job",
          target: job.id,
          job,
          priority: false,
        });
    }
  if (p !== "APPROVER")
    for (const i of interviews) {
      if (i.status !== "COMPLETED") continue;
      if (i.is_participant && !i.feedback_submitted)
        result.push({
          id: `feedback-${i.id}`,
          group: "feedback",
          title: en ? "Submit interview feedback" : "Gửi feedback phỏng vấn",
          context: `${i.candidate_name} · ${i.job_title}`,
          owner: userName,
          role: en ? "Interviewer" : "Người phỏng vấn",
          due: null,
          action: "interview",
          target: i.id,
          priority: true,
        });
      else if (
        p !== "INTERVIEWER" &&
        (i.can_manage || i.can_decide) &&
        i.feedback_count < (i.participants?.length || 0)
      )
        result.push({
          id: `followup-${i.id}`,
          group: "followup",
          title: en
            ? "Review outstanding interview feedback"
            : "Theo dõi feedback còn thiếu",
          context: `${i.candidate_name} · ${i.job_title}`,
          owner: i.participants.map((x) => x.display_name).join(", ") || "—",
          role: en ? "Interview team" : "Nhóm phỏng vấn",
          due: null,
          action: "interview",
          target: i.id,
          priority: false,
        });
    }
  if (["ADMIN", "RECRUITER", "APPROVER"].includes(p))
    for (const o of offers) {
      if (o.status !== "PENDING") continue;
      const mine = o.approver_id === userId && o.can_approve;
      if (p === "APPROVER" && !mine) continue;
      result.push({
        id: `offer-${o.id}`,
        group: mine ? "approval" : "followup",
        title: mine
          ? en
            ? "Review offer proposal"
            : "Duyệt đề xuất tuyển dụng"
          : en
            ? "Follow up on offer approval"
            : "Theo dõi đề xuất chờ duyệt",
        context: `${o.candidate_name} · ${o.job_title}`,
        owner: mine
          ? userName
          : en
            ? "Assigned approver"
            : "Người duyệt được chỉ định",
        role: en ? "Approver" : "Người duyệt",
        due: null,
        action: "offer",
        target: o.id,
        priority: mine,
      });
    }
  if (["ADMIN", "RECRUITER", "HIRING_MANAGER"].includes(p))
    for (const job of jobs) {
      const draft = job.status === "DRAFT";
      if (draft && p !== "ADMIN" && p !== "RECRUITER") continue;
      if (
        !draft &&
        !(
          job.status === "OPEN" &&
          ["HIGH", "CRITICAL"].includes(job.priority || "")
        )
      )
        continue;
      result.push({
        id: `job-${job.id}`,
        group: "job",
        title: draft
          ? en
            ? "Complete draft job"
            : "Hoàn thiện Job bản nháp"
          : en
            ? "Review high-priority job"
            : "Job ưu tiên cao / khẩn cấp",
        context: job.title,
        ...jobRecruitingOwner(job.id, input.recruiters, en),
        due: null,
        action: "job",
        target: job.id,
        job,
        priority: !draft,
      });
    }
  return result.sort(
    (a, b) =>
      Number(b.priority) - Number(a.priority) ||
      (a.due ? Date.parse(a.due) : Infinity) -
        (b.due ? Date.parse(b.due) : Infinity) ||
      a.id.localeCompare(b.id),
  );
}
