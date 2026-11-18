import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {render,screen,fireEvent,waitFor,cleanup} from "@testing-library/react";
import JobEdit from "../components/job-edit";
import {ApiError} from "../lib/supabase";
const api=vi.hoisted(()=>({get:vi.fn(),update:vi.fn()}));
vi.mock("../lib/admin-jobs",()=>({getJobEdit:api.get,updateJobEdit:api.update}));
const job={id:"j",title:"Existing engineer",job_code:"ATS-KEEP",status:"OPEN",updated_at:"2026-11-18T00:00:00.123456Z",business_unit:null,location:null,level:null,function_group:null,hiring_season:null,priority:null};
const props={jobId:"j",onSaved:vi.fn(async()=>{}),onCancel:vi.fn(),onAccessLost:vi.fn()};
beforeEach(()=>{vi.clearAllMocks();api.get.mockResolvedValue({job});api.update.mockResolvedValue({job:{job_id:"j"}});localStorage.clear();});afterEach(cleanup);
it("loads an open Job, keeps code/status read-only and sends only edited fields without filling null SLA",async()=>{
 render(<JobEdit {...props}/>);await screen.findByDisplayValue(job.title);
 expect((screen.getByLabelText("Mã Job") as HTMLInputElement).readOnly).toBe(true);
 expect((screen.getByLabelText("Trạng thái") as HTMLInputElement).value).toBe("OPEN");
 expect((screen.getByLabelText("Level") as HTMLSelectElement).value).toBe("");
 expect(screen.getByRole("button",{name:"Lưu thay đổi"}).hasAttribute("disabled")).toBe(true);
 fireEvent.change(screen.getByLabelText("Tên vị trí"),{target:{value:"Updated engineer"}});
 fireEvent.click(screen.getByRole("button",{name:"Lưu thay đổi"}));
 await waitFor(()=>expect(props.onSaved).toHaveBeenCalledOnce());
 expect(api.update.mock.calls[0][0]).toMatchObject({jobId:"j",expectedUpdatedAt:job.updated_at,changes:{title:"Updated engineer"}});
 expect(Object.keys(api.update.mock.calls[0][0].changes)).toEqual(["title"]);
});
it("retries the exact edit after an unknown outcome and cannot alter the payload meanwhile",async()=>{
 api.update.mockRejectedValueOnce(new ApiError("Lost response",503));render(<JobEdit {...props}/>);
 await screen.findByDisplayValue(job.title);
 fireEvent.change(screen.getByLabelText("Địa điểm"),{target:{value:"HCMC"}});
 fireEvent.click(screen.getByRole("button",{name:"Lưu thay đổi"}));
 const retry=await screen.findByRole("button",{name:"Thử lại yêu cầu cũ"});
 expect((screen.getByLabelText("Tên vị trí") as HTMLInputElement).closest("fieldset")?.disabled).toBe(true);
 fireEvent.click(retry);await waitFor(()=>expect(api.update).toHaveBeenCalledTimes(2));
 expect(api.update.mock.calls[0][0]).toEqual(api.update.mock.calls[1][0]);
});
it("blocks a stale edit until explicitly reloaded and denies unauthorized reads",async()=>{
 api.update.mockRejectedValueOnce(new ApiError("Changed",409));render(<JobEdit {...props}/>);await screen.findByDisplayValue(job.title);
 fireEvent.change(screen.getByLabelText("Địa điểm"),{target:{value:"Hanoi"}});
 fireEvent.click(screen.getByRole("button",{name:"Lưu thay đổi"}));
 const reload=await screen.findByRole("button",{name:"Tải bản mới nhất"});
 expect(screen.getByRole("button",{name:"Lưu thay đổi"}).hasAttribute("disabled")).toBe(true);
 api.get.mockRejectedValueOnce(new ApiError("Denied",403));fireEvent.click(reload);
 await waitFor(()=>expect(props.onAccessLost).toHaveBeenCalledOnce());expect(screen.queryByDisplayValue(job.title)).toBeNull();
});
it("does not offer write retry when only the refresh after successful save failed",async()=>{
 render(<JobEdit {...props} onSaved={async()=>{throw Error("offline");}}/>);await screen.findByDisplayValue(job.title);
 fireEvent.change(screen.getByLabelText("Địa điểm"),{target:{value:"VN"}});fireEvent.click(screen.getByRole("button",{name:"Lưu thay đổi"}));
 await screen.findByText(/Đã lưu Job nhưng danh sách chưa tải lại/);
 expect(screen.queryByRole("button",{name:"Thử lại yêu cầu cũ"})).toBeNull();expect(api.update).toHaveBeenCalledOnce();
});

import JobsMaster from "../components/bosch-jobs-master";
import JobDetail from "../components/bosch-job-detail";
it("offers row and snapshot edit for the selected Job and hides edits when unauthorized or closed",()=>{
 const edit=vi.fn(),noop=()=>{};
 const props={jobs:[job],allJobs:[job],query:"",onQuery:noop,status:"ALL",onStatus:noop,onSelect:noop,onOpen:noop,onEdit:edit};
 const view=render(<JobsMaster {...props}/>);
 fireEvent.click(screen.getByRole("button",{name:`Sửa Job: ${job.title}`}));expect(edit).toHaveBeenCalledWith(job);
 fireEvent.click(screen.getByRole("button",{name:"Sửa Job"}));expect(edit).toHaveBeenCalledTimes(2);
 view.rerender(<JobsMaster {...props} onEdit={undefined}/>);expect(screen.queryByRole("button",{name:/Sửa Job/})).toBeNull();
 view.rerender(<JobsMaster {...props} jobs={[{...job,status:"CLOSED"}]} allJobs={[{...job,status:"CLOSED"}]}/>);expect(screen.queryByRole("button",{name:/Sửa Job/})).toBeNull();
});
it("exposes editing in Job Detail only to Admin for an editable Job",()=>{
 const edit=vi.fn();const props={job,onBack:()=>{},onModule:()=>{},canViewOffers:false,canAdmin:true,onEdit:edit,children:<span>Pipeline</span>};
 const view=render(<JobDetail {...props}/>);fireEvent.click(screen.getByRole("button",{name:"Sửa Job"}));expect(edit).toHaveBeenCalledWith(job);
 view.rerender(<JobDetail {...props} canAdmin={false}/>);expect(screen.queryByRole("button",{name:"Sửa Job"})).toBeNull();
});
