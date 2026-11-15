import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import BoschJobDetail from "../components/bosch-job-detail";
afterEach(cleanup);
const job = {id:"job-1", job_code:"JOB-1001", title:"Senior Embedded Software Engineer (EPC)", status:"OPEN", location:"Ho Chi Minh City",business_unit:"EPC – Embedded Systems",req_date:"2026-10-10"};
const next = {id:"job-2",job_code:"JOB-1002",title:"Software Tester",status:"DRAFT"};
it("shows the reference Job ID layout and navigates with actual Job data",()=>{
 const onBack=vi.fn(),onSelectJob=vi.fn(),onModule=vi.fn();
 render(<BoschJobDetail job={job} allJobs={[job,next]} onSelectJob={onSelectJob} onBack={onBack} onModule={onModule} canViewOffers canAdmin><div>Pipeline Fixture</div></BoschJobDetail>);
 expect(screen.getByRole("heading",{name:"Senior Embedded Software Engineer (EPC)"})).toBeTruthy();
 expect(screen.getByText("EPC – Embedded Systems")).toBeTruthy();
 expect(screen.getByText("Pipeline Fixture")).toBeTruthy();
 expect(screen.getByRole("navigation",{name:"Job sections"})).toBeTruthy();
 expect(screen.getByText("Open")).toBeTruthy();
 fireEvent.click(screen.getByRole("button",{name:"Quay lại Bảng Master"}));
 expect(onBack).toHaveBeenCalledTimes(1);
 fireEvent.change(screen.getByRole("combobox",{name:"Chọn Job cho Hiring Pipeline"}),{target:{value:"job-2"}});
 expect(onSelectJob).toHaveBeenCalledWith(next);
 fireEvent.click(screen.getByRole("button",{name:"Interviews"}));
 fireEvent.click(screen.getByRole("button",{name:/Mở lịch phỏng vấn|Full interview worklist/}));
 expect(onModule).toHaveBeenCalledWith("interviews");
});
it("hides unauthorized Offer navigation on Job Detail",()=>{
 render(<BoschJobDetail job={job} allJobs={[job]} onSelectJob={vi.fn()} onBack={vi.fn()} onModule={vi.fn()} canViewOffers={false} canAdmin={false}><span>Work</span></BoschJobDetail>);
 expect(screen.queryByRole("button",{name:"Offers"})).toBeNull();
});


it("Job Details shows real requisition metadata and configured SLA without inventing actual SLA", () => {
 const rich = {...job, level:52, function_group:"Tech/Product", request_type:"REPLACEMENT", replacement_for:"Previous engineer", hiring_season:"Normal Time", priority:"HIGH", sla_target_workdays:35};
 render(<BoschJobDetail job={rich} allJobs={[rich]} onSelectJob={vi.fn()} onBack={vi.fn()} onModule={vi.fn()} canViewOffers={false} canAdmin={false}><span>Pipeline</span></BoschJobDetail>);
 fireEvent.click(screen.getByRole("button",{name:"Job Details"}));
 const detail=screen.getByRole("region",{name:"Job Details"});
 expect(detail.textContent).toContain("Previous engineer");
 expect(detail.textContent).toContain("35 workdays");
 expect(detail.textContent).toContain("Normal Time");
 expect(detail.textContent).toContain("L52");
 expect(detail.textContent).toContain("SLA actual");
 expect(detail.textContent).not.toContain("On time");
});
it("Sourcing only shows existing authorized metrics and handles missing metrics", () => {
 const withMetrics={...job, metrics:{total_candidates:8,new_count:3,screening_count:2,interview_count:2,hired_count:1,rejected_count:0,source_summary:[{source:"Referral",sub_source:"Employee",source_ownership:"Company",count:8}]}};
 const view=render(<BoschJobDetail job={withMetrics} allJobs={[withMetrics]} onSelectJob={vi.fn()} onBack={vi.fn()} onModule={vi.fn()} canViewOffers={false} canAdmin={false}><span>Pipeline</span></BoschJobDetail>);
 fireEvent.click(screen.getByRole("button",{name:"Sourcing"}));
 expect(screen.getByText("Referral")).toBeTruthy();
 expect(screen.getByText("Employee")).toBeTruthy();
 expect(screen.getByRole("table")).toBeTruthy();
 view.rerender(<BoschJobDetail job={{...job}} allJobs={[job]} onSelectJob={vi.fn()} onBack={vi.fn()} onModule={vi.fn()} canViewOffers={false} canAdmin={false}><span>Pipeline</span></BoschJobDetail>);
 expect(screen.getByText("Job này chưa có dữ liệu nguồn tuyển dụng được API trả về.")).toBeTruthy();
});
it("Team and Access only exposes the current role's verified permissions, not a fabricated team list", () => {
 render(<BoschJobDetail job={job} allJobs={[job]} onSelectJob={vi.fn()} onBack={vi.fn()} onModule={vi.fn()}
   canViewOffers={false} canManageApplications={false} roles={["HIRING_MANAGER"]} canAdmin={false}><span>Pipeline</span></BoschJobDetail>);
 fireEvent.click(screen.getByRole("button",{name:"Team & Access"}));
 expect(screen.getByText("HIRING_MANAGER")).toBeTruthy();
 expect(screen.getByText("Chỉ xem")).toBeTruthy();
 expect(screen.queryByRole("button",{name:"Quản lý phân quyền"})).toBeNull();
 expect(screen.getByText(/API Job hiện không trả danh sách đầy đủ thành viên/)).toBeTruthy();
});
