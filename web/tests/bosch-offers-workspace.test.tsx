import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import BoschOffersWorkspace from "../components/bosch-offers-workspace";
import { ApiError } from "../lib/supabase";

const api = vi.hoisted(() => ({ list: vi.fn(), detail: vi.fn() }));
vi.mock("../lib/offer-workspace", () => ({
  listOfferProposals: api.list,
  offerProposalDetail: api.detail,
}));
vi.mock("../lib/supabase", () => ({
  ApiError: class ApiError extends Error { constructor(message: string, public status?: number) { super(message); } },
}));
const jobs = [{id: "job-1",job_code:"TEST-1",title:"Synthetic Test Job",status:"OPEN"}];
const offer = { id:"11111111-1111-4111-8111-111111111111", application_id:"app-1",job_id:"job-1",
  job_code:"TEST-1",job_title:"Synthetic Test Job",candidate_name:"Sample Candidate",
  currency:"VND",base_salary:1000000,proposed_start_date:null,status:"PENDING",created_at:"2026-01-01T00:00:00Z",
  updated_at:"2026-01-01T00:00:00Z",sent_at:null,expires_at:null,responded_at:null };
beforeEach(()=>{
 api.list.mockReset();api.detail.mockReset();
 api.list.mockResolvedValue({offers:[offer],limit:25,offset:0});
 api.detail.mockResolvedValue({offer,application:{id:"app-1",stage:"INTERVIEW",status:"ACTIVE"},
 candidate:{id:"cand-1",full_name:"Sample Candidate"},job:{id:"job-1",title:"Synthetic Test Job"},events:[{event_type:"CREATED",created_at:"2026-01-01T00:00:00Z",actor_id:"user-1",actor_name:"Synthetic Recruiter"}]});
});
afterEach(cleanup);
it("reads job-scoped Offer list and detail without writing", async()=>{
 render(<BoschOffersWorkspace jobs={jobs} onAccessLost={vi.fn()}/>);
 const name=await screen.findByRole("button",{name:"Sample Candidate"});
 expect(api.list).toHaveBeenCalledWith("job-1",25,0);
 expect(screen.getByText("Pending Approval")).toBeTruthy();
 fireEvent.click(name);
 await waitFor(()=>expect(api.detail).toHaveBeenCalledWith(offer.id));
 expect(screen.getByText("Synthetic Recruiter",{exact:false})).toBeTruthy();
 expect(screen.getByText("1.000.000 VND")).toBeTruthy();
});
it("clears scoped Offer state and invalidates access after 403", async()=>{
 api.list.mockRejectedValue(new ApiError("No Offer access",403));
 const onAccessLost=vi.fn();
 render(<BoschOffersWorkspace jobs={jobs} onAccessLost={onAccessLost}/>);
 await waitFor(()=>expect(onAccessLost).toHaveBeenCalledTimes(1));
 expect(screen.queryByRole("button",{name:"Sample Candidate"})).toBeNull();
});
