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
 fireEvent.click(screen.getByRole("button",{name:/Open Interviews/}));
 expect(onModule).toHaveBeenCalledWith("interviews");
});
it("hides unauthorized Offer navigation on Job Detail",()=>{
 render(<BoschJobDetail job={job} allJobs={[job]} onSelectJob={vi.fn()} onBack={vi.fn()} onModule={vi.fn()} canViewOffers={false} canAdmin={false}><span>Work</span></BoschJobDetail>);
 expect(screen.queryByRole("button",{name:"Offers"})).toBeNull();
});
