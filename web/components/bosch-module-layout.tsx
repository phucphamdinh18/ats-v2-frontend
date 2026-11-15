"use client";
import type { ReactNode } from "react";
import { ChevronRight, Layers3, MapPin } from "lucide-react";
import candidateStyles from "./bosch-v2-candidate-frame.module.css";
import interviewStyles from "./bosch-v2-interview-frame.module.css";
import offerStyles from "./bosch-v2-offer-frame.module.css";
import { useLanguage } from "./language";

type Module = "candidates" | "interviews" | "offers";
const specs: Record<Module, { title: string; crumb: string; tabs: string[]; active: string; help: string }> = {
  candidates: {
    title: "Candidates", crumb: "Candidate Database",
    tabs: ["Candidate Database", "Talent Pool", "Archived"], active: "Candidate Database",
    help: "Profiles from the approved candidate pool in your access scope.",
  },
  interviews: {
    title: "Interviews", crumb: "Interviews",
    tabs: ["Pipeline", "Schedule", "Feedback", "Analytics"], active: "Schedule",
    help: "Actual scheduled interview records from the current ATS API.",
  },
  offers: {
    title: "Offers", crumb: "Offers",
    tabs: ["Pipeline", "Offer Templates", "Approval Setup", "Offer Settings"], active: "Pipeline",
    help: "Current job-scoped Offer records and approved backend statuses.",
  },
};

/**
 * Visual composition only: no synthetic API data, no change of workflow.
 * Unsupported reference-image tabs are non-interactive labels.
 */
export default function BoschModuleLayout({ module, children }: { module: Module; children: ReactNode }) {
  const meta = specs[module];
  const { locale } = useLanguage();
  const en = locale === "en";
  if (module === "candidates") {
    return <section className={candidateStyles.root} aria-label={en ? "Candidates workspace" : "Không gian ứng viên"}>
      <div className={candidateStyles.crumb}>{en ? "Candidates" : "Ứng viên"} <ChevronRight size={14}/><strong>{en ? "Candidate Database" : "Danh sách ứng viên"}</strong></div>
      <h1 className={candidateStyles.heading}>{en ? "Candidates" : "Ứng viên"}</h1>
      <p className={candidateStyles.subtitle}>{en ? "Profiles in your authorized ATS workspace." : "Các hồ sơ ứng viên trong phạm vi ATS bạn được cấp quyền."}</p>
      <nav className={candidateStyles.tabs} aria-label={en ? "Candidates sections" : "Mục ứng viên"}>
        <span aria-current="page" className={candidateStyles.active}>{en ? "Candidate Database" : "Danh sách ứng viên"}</span>
        <span title={en ? "Not available in current API" : "API hiện tại chưa hỗ trợ"}>Talent Pool</span>
        <span title={en ? "Not available in current API" : "API hiện tại chưa hỗ trợ"}>{en ? "Archived" : "Đã lưu trữ"}</span>
      </nav>
      {children}
    </section>;
  }
  if (module === "interviews") {
    return <section className={interviewStyles.root} aria-label={en ? "Interviews workspace" : "Không gian phỏng vấn"}>
      <div className={interviewStyles.crumb}>{en ? "Interviews" : "Phỏng vấn"} <ChevronRight size={14}/><strong>{en ? "Schedule" : "Lịch phỏng vấn"}</strong></div>
      <h1 className={interviewStyles.title}>{en ? "Interviews" : "Phỏng vấn"}</h1>
      <p className={interviewStyles.subtitle}>{en ? "Appointments in your authorized ATS workspace." : "Các lịch phỏng vấn bạn được phép truy cập trên ATS."}</p>
      <nav className={interviewStyles.tabs} aria-label={en ? "Interviews sections" : "Mục phỏng vấn"}>
        <span title={en ? "Coming after verified workflow integration" : "Chờ hoàn tất tích hợp quy trình nghiệp vụ"}>Pipeline</span>
        <span className={interviewStyles.active} aria-current="page">{en ? "Schedule" : "Lịch phỏng vấn"}</span>
        <span title={en ? "Requires authorized feedback workflow integration" : "Cần tích hợp quy trình đánh giá theo quyền"}>{en ? "Feedback" : "Đánh giá"}</span>
        <span title={en ? "Not available in existing summary API" : "API hiện tại chưa có báo cáo tổng hợp"}>{en ? "Analytics" : "Báo cáo"}</span>
      </nav>
      {children}
    </section>;
  }
  if (module === "offers") {
    return <section className={offerStyles.root} aria-label="Offers workspace">
      <div className={offerStyles.crumb}>Offers <ChevronRight size={14}/><strong>Offer Pipeline</strong></div>
      <h1 className={offerStyles.title}>Offers</h1>
      <p className={offerStyles.subtitle}>Offer proposals for Jobs within your authorized scope.</p>
      <nav className={offerStyles.tabs} aria-label="Offers sections">
        <span className={offerStyles.active} aria-current="page">Pipeline</span>
        <span title="Not available in the current Offer API">Offer Templates</span>
        <span title="Existing approvals must remain in their authorized workflow">Approval Setup</span>
        <span title="Not available in the current Offer API">Offer Settings</span>
      </nav>
      {children}
    </section>;
  }
  return <section className={`bosch-module-page bosch-module-${module}`} aria-label={`${meta.title} workspace`}>
    <div className="bosch-breadcrumb"><span>{meta.title}</span><ChevronRight size={14}/><strong>{meta.crumb}</strong></div>
    <div className="bosch-job-title-row"><h1>{meta.title}</h1></div>
    <div className="bosch-job-metadata"><span><Layers3 size={16}/>ATS V2</span><span><MapPin size={16}/>Authorized workspace</span></div>
    <nav className="bosch-job-tabs" aria-label={`${meta.title} sections`}>
      {meta.tabs.map((tab) => <span key={tab} aria-current={tab === meta.active ? "page" : undefined} className={tab === meta.active ? "active" : "bosch-unavailable-tab"} title={tab !== meta.active ? "Not yet available in existing backend contract" : undefined}>{tab}</span>)}
    </nav>
    <div className="bosch-module-content">{children}</div>
  </section>;
}
