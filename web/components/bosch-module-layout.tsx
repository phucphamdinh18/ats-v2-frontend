"use client";
import type { ReactNode } from "react";
import { ChevronRight, Layers3, MapPin } from "lucide-react";
import candidateStyles from "./bosch-v2-candidate-frame.module.css";
import interviewStyles from "./bosch-v2-interview-frame.module.css";
import offerStyles from "./bosch-v2-offer-frame.module.css";

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
  if (module === "candidates") {
    return <section className={candidateStyles.root} aria-label="Candidates workspace">
      <div className={candidateStyles.crumb}>Candidates <ChevronRight size={14}/><strong>Candidate Database</strong></div>
      <h1 className={candidateStyles.heading}>Candidates</h1>
      <p className={candidateStyles.subtitle}>Profiles in your authorized ATS workspace.</p>
      <nav className={candidateStyles.tabs} aria-label="Candidates sections">
        <span aria-current="page" className={candidateStyles.active}>Candidate Database</span>
        <span title="Not available in current API">Talent Pool</span>
        <span title="Not available in current API">Archived</span>
      </nav>
      {children}
    </section>;
  }
  if (module === "interviews") {
    return <section className={interviewStyles.root} aria-label="Interviews workspace">
      <div className={interviewStyles.crumb}>Interviews <ChevronRight size={14}/><strong>Schedule</strong></div>
      <h1 className={interviewStyles.title}>Interviews</h1>
      <p className={interviewStyles.subtitle}>Appointments in your authorized ATS workspace.</p>
      <nav className={interviewStyles.tabs} aria-label="Interviews sections">
        <span title="Coming after verified workflow integration">Pipeline</span>
        <span className={interviewStyles.active} aria-current="page">Schedule</span>
        <span title="Requires authorized feedback workflow integration">Feedback</span>
        <span title="Not available in existing summary API">Analytics</span>
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
