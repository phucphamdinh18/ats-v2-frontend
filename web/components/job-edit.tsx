"use client";
import {useCallback,useEffect,useRef,useState,type FormEvent} from "react";
import {BriefcaseBusiness,Save,ShieldCheck,RefreshCw} from "lucide-react";
import {getJobEdit,updateJobEdit,type JobEditCommand,type JobEditFields,type JobOpeningEditor} from "@/lib/admin-jobs";
import {ApiError} from "@/lib/supabase";
import {useLanguage} from "./language";
import styles from "./admin-workspace.module.css";
const keys: (keyof JobEditFields)[]=["title","business_unit","location","level","function_group","hiring_season","req_date","request_type","priority","replacement_for"];
function fields(j:JobOpeningEditor):JobEditFields {
 return {title:j.title,business_unit:j.business_unit??null,location:j.location??null,level:j.level??null,
 function_group:j.function_group??null,hiring_season:j.hiring_season??null,req_date:j.req_date??null,
 request_type:j.request_type??null,priority:j.priority??null,replacement_for:j.replacement_for??null};
}
export default function JobEdit({jobId,onSaved,onCancel,onAccessLost}:{jobId:string;onSaved:()=>Promise<void>;onCancel:()=>void;onAccessLost:()=>void}) {
 const {locale}=useLanguage(),en=locale==="en",tr=(vi:string,english:string)=>en?english:vi;
 const [job,setJob]=useState<JobOpeningEditor|null>(null),[form,setForm]=useState<JobEditFields|null>(null),
 [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),
 [conflict,setConflict]=useState(false),[saved,setSaved]=useState(false),[pending,setPending]=useState<JobEditCommand|null>(null);
 const epoch=useRef(0),lock=useRef(false);
 const load=useCallback(async()=>{
  const ticket=++epoch.current;setLoading(true);setError("");setJob(null);setForm(null);setConflict(false);setPending(null);setSaved(false);
  try {const r=await getJobEdit(jobId);if(ticket!==epoch.current)return;setJob(r.job);setForm(fields(r.job));}
  catch(e){if(ticket!==epoch.current)return;setError(e instanceof Error?e.message:"Không tải được Job.");if(e instanceof ApiError&&e.status===401)onAccessLost();}
  finally{if(ticket===epoch.current)setLoading(false);}
 },[jobId,onAccessLost]);
 useEffect(()=>{void load();return()=>{epoch.current++;};},[load]);
 const changes:Partial<JobEditFields>={};
 if(job&&form){const original=fields(job);for(const k of keys)if(form[k]!==original[k])Object.assign(changes,{[k]:form[k]});}
 const frozen=loading||busy||!!pending||conflict||saved;
 function set<K extends keyof JobEditFields>(key:K,value:JobEditFields[K]){setForm(f=>f?{...f,[key]:value}:f);}
 async function save(command:JobEditCommand){
  if(lock.current)return;lock.current=true;const ticket=epoch.current;setBusy(true);setPending(command);setError("");
  try{await updateJobEdit(command);if(ticket!==epoch.current)return;setPending(null);setSaved(true);
   try{await onSaved();}catch{if(ticket===epoch.current)setError(tr("Đã lưu Job nhưng danh sách chưa tải lại. Hãy tải lại trang, không gửi lại.","Job saved but the list could not refresh. Reload without resubmitting."));}
  }catch(e){if(ticket!==epoch.current)return;if(e instanceof ApiError&&e.status&&e.status<500)setPending(null);
   if(e instanceof ApiError&&e.status===409)setConflict(true);
   setError(e instanceof Error?e.message:tr("Không lưu được Job.","Could not save Job."));
   if(e instanceof ApiError&&e.status===401)onAccessLost();
  }finally{lock.current=false;if(ticket===epoch.current)setBusy(false);}
 }
 function submit(e:FormEvent){e.preventDefault();if(frozen||!job||!Object.keys(changes).length)return;
  void save({jobId,requestId:crypto.randomUUID(),expectedUpdatedAt:job.updated_at,changes});}
 const unset=tr("Chưa thiết lập","Not set");
 return <section className={styles.root} aria-label={tr("Sửa Job","Edit Job")}>
  <header className={styles.header}><div className={styles.headingIcon}><BriefcaseBusiness size={24}/></div>
   <div><h1>{tr("Sửa Job","Edit Job")}</h1><p>{job?.title||tr("Đang tải thông tin vị trí…","Loading position details…")}</p></div>
   <span className={styles.adminBadge}><ShieldCheck size={14}/>Admin</span></header>
  {error&&<p role="alert" className={styles.error}>{error}</p>}
  {(conflict||(!loading&&!job))&&<button disabled={busy} onClick={()=>void load()}><RefreshCw size={16}/>{tr("Tải bản mới nhất","Load latest version")}</button>}
  {pending&&<div role="status" className={styles.notice}>{tr("Chưa xác định kết quả lưu. Thử lại đúng yêu cầu cũ.","Save outcome unknown. Retry the original request.")}<button disabled={busy} onClick={()=>void save(pending)}>{tr("Thử lại yêu cầu cũ","Retry original request")}</button></div>}
  {loading&&<p role="status">{tr("Đang tải Job…","Loading Job…")}</p>}
  {job&&form&&<div className={styles.layout}><form className={styles.card} onSubmit={submit}>
   <fieldset disabled={frozen}><legend>{tr("Thông tin vị trí","Position details")}</legend><div className={styles.fields}>
    <label>{tr("Mã Job","Job code")}<input readOnly value={job.job_code||"—"}/></label>
    <label>{tr("Trạng thái","Status")}<input readOnly value={job.status}/></label>
    <label className={styles.wide}>{tr("Tên vị trí","Job title")}<input required minLength={3} maxLength={180} value={form.title} onChange={e=>set("title",e.target.value)}/></label>
    <label>{tr("Bộ phận","Department")}<input maxLength={120} value={form.business_unit||""} onChange={e=>set("business_unit",e.target.value||null)}/></label>
    <label>{tr("Địa điểm","Location")}<input maxLength={120} value={form.location||""} onChange={e=>set("location",e.target.value||null)}/></label>
   </div></fieldset>
   <fieldset disabled={frozen}><legend>{tr("Yêu cầu tuyển dụng và SLA","Hiring requirements and SLA")}</legend><div className={styles.fields}>
    <label>Level<select value={form.level??""} onChange={e=>set("level",e.target.value===""?null:Number(e.target.value))}><option value="">{unset}</option>{Array.from({length:16},(_,i)=>15-i).map(v=><option key={v} value={v}>{v}</option>)}</select></label>
    <label>{tr("Nhóm chức năng","Function group")}<select value={form.function_group||""} onChange={e=>set("function_group",e.target.value||null)}><option value="">{unset}</option><option>Tech/Product</option><option>Non-Tech/Non-Product</option></select></label>
    <label>{tr("Mùa tuyển dụng","Hiring season")}<select value={form.hiring_season||""} onChange={e=>set("hiring_season",e.target.value||null)}><option value="">{unset}</option><option>Normal Time</option><option>High Time</option></select></label>
    <label>{tr("Ngày yêu cầu","Requisition date")}<input type="date" value={form.req_date||""} onChange={e=>set("req_date",e.target.value||null)}/></label>
    <label>{tr("Loại yêu cầu","Request type")}<select value={form.request_type||""} onChange={e=>{set("request_type",e.target.value||null);if(e.target.value!=="REPLACEMENT")set("replacement_for",null);}}><option value="">{unset}</option><option value="NEW">{tr("Tuyển mới","New hire")}</option><option value="REPLACEMENT">{tr("Thay thế","Replacement")}</option></select></label>
    <label>{tr("Ưu tiên","Priority")}<select value={form.priority||""} onChange={e=>set("priority",e.target.value||null)}><option value="">{unset}</option>{["CRITICAL","HIGH","NORMAL","LOW"].map(v=><option key={v}>{v}</option>)}</select></label>
    {form.request_type==="REPLACEMENT"&&<label className={styles.wide}>{tr("Thay thế vị trí","Replacement for")}<input required maxLength={180} value={form.replacement_for||""} onChange={e=>set("replacement_for",e.target.value||null)}/></label>}
   </div></fieldset>
   <footer className={`${styles.actions} ${styles.saveActions}`}><button type="button" disabled={busy||!!pending} onClick={onCancel}>{tr("Hủy","Cancel")}</button>
    <button type="submit" className={styles.primary} disabled={frozen||!Object.keys(changes).length}><Save size={22}/>{tr("Lưu thay đổi","Save changes")}</button></footer>
  </form><aside className={styles.side}><section className={styles.card}><h3>{tr("Sửa thông tin Job","Edit Job information")}</h3><p className={styles.muted}>{tr("Mã Job và trạng thái được giữ nguyên. Việc sửa không thay đổi team, hồ sơ ứng viên, lịch phỏng vấn hoặc Offer.","Job code and status stay unchanged. Editing does not change the team, applications, interviews or Offers.")}</p><p className={styles.muted}>{tr("Khi đổi cấu hình SLA, chọn đủ Level, nhóm chức năng và mùa tuyển dụng. Các trường chưa thiết lập sẽ giữ trống nếu bạn không sửa.","When changing SLA settings, select level, function group and hiring season together. Unset fields remain unset unless edited.")}</p></section></aside></div>}
 </section>;
}
