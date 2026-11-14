"use client";
import type { ReactNode } from "react";
import { ChevronRight, Layers3, MapPin } from "lucide-react";

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
