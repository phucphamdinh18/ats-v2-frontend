"use client";
import { useEffect, useRef, useState } from "react";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import styles from "./bosch-v2-offers.module.css";
import type { Job } from "@/lib/policy";
import { ApiError } from "@/lib/supabase";
import { listOfferProposals, offerProposalDetail, type OfferProposal, type OfferProposalDetail } from "@/lib/offer-workspace";

const PAGE_SIZE = 25;
function time(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("en-GB", {day:"2-digit",month:"short",year:"numeric"}).format(date) : "—";
}
function money(amount: number, currency: string) {
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("vi-VN", {maximumFractionDigits: 0}).format(amount)+" "+currency.toUpperCase();
}
function statusLabel(value: string) {
  const labels: Record<string,string> = {PENDING:"Pending Approval",APPROVED:"Approved",REJECTED:"Rejected",SENT:"Sent",ACCEPTED:"Accepted",DECLINED:"Declined",WITHDRAWN:"Withdrawn",EXPIRED:"Expired"};
  return labels[value] || value;
}
export default function BoschOffersWorkspace({ jobs, onAccessLost }: { jobs: Job[]; onAccessLost: () => void }) {
  const [jobId, setJobId] = useState(jobs[0]?.id||"");
  const [rows, setRows] = useState<OfferProposal[]>([]);
  const [offset, setOffset] = useState(0);
  const [selectedId, setSelectedId] = useState<string|null>(null);
  const [detail, setDetail] = useState<OfferProposalDetail|null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");
  const request = useRef(0);
  const detailRequest = useRef(0);
  const selected = rows.find(x=>x.id===selectedId);
  const job = jobs.find(x=>x.id===jobId);
  useEffect(()=>{
    const valid = jobs.some(x=>x.id===jobId);
    if(!valid) setJobId(jobs[0]?.id||"");
  },[jobs,jobId]);
  useEffect(()=>{
    const ticket=++request.current;
    ++detailRequest.current;
    setRows([]);setDetail(null);setSelectedId(null);setError("");setDetailError("");setBusy(true);
    if(!jobId){setBusy(false);return;}
    void listOfferProposals(jobId,PAGE_SIZE,offset).then(r=>{
      if(ticket!==request.current)return;
      setRows(r.offers);
    }).catch(e=>{
      if(ticket!==request.current)return;
      setError(e instanceof Error?e.message:"Không tải được Offer.");
      if(e instanceof ApiError && (e.status===401||e.status===403))onAccessLost();
    }).finally(()=>{if(ticket===request.current)setBusy(false);});
    return ()=>{request.current+=1;detailRequest.current+=1;};
  },[jobId,offset,onAccessLost]);
  async function choose(item: OfferProposal){
    const ticket=++detailRequest.current;
    setSelectedId(item.id);setDetail(null);setDetailError("");
    try{
      const r=await offerProposalDetail(item.id);
      if(ticket===detailRequest.current)setDetail(r);
    }catch(e){
      if(ticket!==detailRequest.current)return;
      setDetailError(e instanceof Error?e.message:"Không tải được chi tiết Offer.");
      if(e instanceof ApiError && (e.status===401||e.status===403))onAccessLost();
    }
  }
  const matching=rows.filter(x=>`${x.candidate_name} ${x.job_title} ${x.status}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const perStatus=(s:string)=>rows.filter(x=>x.status===s).length;
  return <section className={styles.root}>
    <div className={styles.summary}>
      <div className={styles.title}><h2>Offer Pipeline <span title="Counts reflect only the current page." aria-hidden="true">ⓘ</span></h2>
        <label className={styles.jobSelect}><span>Job Opening</span><select aria-label="Chọn Job Offer" value={jobId} onChange={e=>{setJobId(e.target.value);setOffset(0);}}>{!jobs.length&&<option value="">No authorized jobs</option>}{jobs.map(x=><option key={x.id} value={x.id}>{x.job_code||"—"} · {x.title}</option>)}</select></label>
      </div>
      <div className={styles.stages}>
        <div><span>Draft</span><strong>—</strong></div>
        <div><span>Pending Approval</span><strong>{perStatus("PENDING")}</strong></div>
        <div><span>Sent</span><strong>{perStatus("SENT")}</strong></div>
        <div className={styles.accepted}><span>Accepted</span><strong>{perStatus("ACCEPTED")}</strong></div>
        <div><span>Declined</span><strong>{perStatus("DECLINED")}</strong></div>
      </div>
      <p className={styles.hint}>Current page: {rows.length} records · Approved: {perStatus("APPROVED")} · Draft is not a persisted backend Offer status.</p>
    </div>
    <div className={styles.workspace}><div className={styles.list}>
      <div className={styles.listHead}><h2>Offers ({rows.length} on page)</h2><label className={styles.search}><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} aria-label="Search offers in loaded page" placeholder="Search offers"/></label></div>
      {error&&<p className={styles.error} role="alert">{error}</p>}
      {busy?<p role="status" className={styles.empty}>Loading offers…</p>:<div className={styles.scroll}><table className={styles.table}><thead><tr><th>Candidate</th><th>Job Opening</th><th>Offer Status</th><th>Grade / Level</th><th>Salary Package</th><th>Approvers</th><th>Sent Date</th><th>Expiry</th><th>Last Activity</th></tr></thead><tbody>{matching.map(item=><tr key={item.id} className={item.id===selectedId?styles.selected:""}><td><button type="button" className={styles.link} onClick={()=>void choose(item)}>{item.candidate_name}</button></td><td>{item.job_code||item.job_title}</td><td><span className={`${styles.status} ${item.status==="APPROVED"?styles.statusApproved:item.status==="ACCEPTED"?styles.statusAccepted:item.status==="REJECTED"?styles.statusRejected:item.status==="DECLINED"?styles.statusDeclined:item.status==="WITHDRAWN"?styles.statusWithdrawn:item.status==="EXPIRED"?styles.statusExpired:""}`}>{statusLabel(item.status)}</span></td><td>—</td><td>{money(item.base_salary,item.currency)}</td><td>—</td><td>{time(item.sent_at)}</td><td>{time(item.expires_at)}</td><td>{time(item.updated_at)}</td></tr>)}</tbody></table>{!matching.length&&!error&&<p className={styles.empty}>No offers match this Job and filter.</p>}</div>}
      <div className={styles.pagination}><button className={styles.outline} disabled={busy||offset===0} onClick={()=>setOffset(x=>Math.max(0,x-PAGE_SIZE))}>Previous</button><span>Page {offset/PAGE_SIZE+1}</span><button className={styles.outline} disabled={busy||rows.length<PAGE_SIZE} onClick={()=>setOffset(x=>x+PAGE_SIZE)}>Next</button></div>
    </div>
    <aside className={styles.detail}>
      <div className={styles.detailHead}><h2>{selected?.candidate_name||"Offer Details"}</h2><div className={styles.detailArrows}><button aria-label="Previous Offer" type="button" disabled={!selected||rows.indexOf(selected)===0} onClick={()=>selected&&void choose(rows[rows.indexOf(selected)-1])}><ChevronLeft size={18}/></button><button aria-label="Next Offer" type="button" disabled={!selected||rows.indexOf(selected)>=rows.length-1} onClick={()=>selected&&void choose(rows[rows.indexOf(selected)+1])}><ChevronRight size={18}/></button></div></div>
      <nav className={styles.detailTabs}><span className={styles.active}>Overview</span><span>Compensation</span><span>Approval</span><span>Activity</span></nav>
      {!selected&&<p className={styles.muted}>Select an Offer to view its authorized compensation and audit timeline.</p>}
      {detailError&&<p className={styles.error} role="alert">{detailError}</p>}
      {selected&&!detail&&!detailError&&<p role="status" className={styles.muted}>Loading detail…</p>}
      {detail&&<><section className={styles.detailSection}><h3>Compensation Summary</h3><dl className={styles.facts}><dt>Base Salary</dt><dd>{money(detail.offer.base_salary,detail.offer.currency)}</dd><dt>Grade / Level</dt><dd>—</dd><dt>Start Date</dt><dd>{detail.offer.proposed_start_date||"—"}</dd><dt>Offer Status</dt><dd>{statusLabel(detail.offer.status)}</dd></dl></section>
        <section className={styles.detailSection}><h3>Offer Timeline</h3>{detail.events.length?<ol className={styles.events}>{detail.events.map((ev,i)=><li key={`${ev.created_at}:${i}`}><strong>{ev.event_type}</strong><span>{time(ev.created_at)}{ev.actor_name?" · "+ev.actor_name:""}</span></li>)}</ol>:<p className={styles.muted}>No audit events returned.</p>}</section>
        <section className={styles.detailSection}><h3>Approval Details</h3><p className={styles.muted}>Individual approvers are not returned by this API. Existing approval workflow remains unchanged.</p></section></>}
    </aside></div>
  </section>;
}
