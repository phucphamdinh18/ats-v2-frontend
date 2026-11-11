"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, BriefcaseBusiness, CalendarDays, CheckCheck, ChevronRight, Clock3, GripVertical, RotateCcw, Search, SlidersHorizontal, UsersRound, X } from "lucide-react";
type Stage = "NEW" | "SCREEN" | "INTERVIEW" | "HIRED" | "REJECTED";
type Candidate = { id:string; job:string; name:string; title:string; company:string; initials:string; stage:Stage; source:string; days:number; skills:string[]; next:string; offer?:boolean };
type JobOption = { id:string; title:string; code:string; unit:string };
const columns = [
 {id:"NEW",name:"Mới ứng tuyển",tone:"blue",target:"Mục tiêu 2 ngày"},
 {id:"SCREEN",name:"Sơ loại",tone:"purple",target:"Mục tiêu 3 ngày"},
 {id:"INTERVIEW",name:"Phỏng vấn",tone:"amber",target:"Mục tiêu 4 ngày"},
 {id:"OFFER",name:"Offer",tone:"teal",target:"Theo dõi đề nghị"},
 {id:"HIRED",name:"Đã tuyển",tone:"green",target:"Hoàn tất tuyển dụng"},
 {id:"REJECTED",name:"Từ chối",tone:"gray",target:"Hồ sơ đã kết thúc"},
] as const;
// Synthetic fixtures only. Offer is a board lane, not a new persisted Application stage.
export const demoCandidates:Candidate[] = [
 {id:"demo-01",job:"ats-app",name:"Minh An · Demo",title:"Senior Embedded Engineer",company:"Demo Mobility",initials:"MA",stage:"NEW",source:"LinkedIn",days:1,skills:["C/C++","AUTOSAR"],next:"Trao đổi nguyện vọng và thời gian nhận việc"},
 {id:"demo-02",job:"ats-app",name:"Hoàng Nam · Demo",title:"Embedded Software Engineer",company:"Demo Technology",initials:"HN",stage:"SCREEN",source:"Referral",days:2,skills:["Embedded C","CAN"],next:"Hoàn tất sơ loại và thống nhất vòng kỹ thuật"},
 {id:"demo-03",job:"ats-app",name:"Gia Linh · Demo",title:"Senior Software Engineer",company:"Demo Systems",initials:"GL",stage:"INTERVIEW",source:"ITViec",days:2,skills:["C++","Linux"],next:"Vòng 1 · Phỏng vấn kỹ thuật"},
 {id:"demo-04",job:"ats-app",name:"Quang Huy · Demo",title:"Technical Lead",company:"Demo Automotive",initials:"QH",stage:"INTERVIEW",offer:true,source:"LinkedIn",days:1,skills:["BSP","Leadership"],next:"Chờ phản hồi đề nghị từ ứng viên"},
 {id:"demo-05",job:"ats-app",name:"Thanh Mai · Demo",title:"Embedded Engineer",company:"Demo Software",initials:"TM",stage:"HIRED",source:"Referral",days:0,skills:["C","RTOS"],next:"Đã tuyển · ngày nhận việc chưa ghi nhận"},
 {id:"demo-06",job:"ats-app",name:"Tuấn Khang · Demo",title:"Software Engineer",company:"Demo Labs",initials:"TK",stage:"REJECTED",source:"ITViec",days:0,skills:["Python","Testing"],next:"Đã kết thúc xét tuyển cho Job này"},
 {id:"demo-07",job:"codex-admin",name:"Bảo Minh · Demo",title:"QA Engineer",company:"Demo Quality",initials:"BM",stage:"NEW",source:"ITViec",days:1,skills:["API testing","SQL"],next:"Kiểm tra hồ sơ và liên hệ ứng viên"},
];
const lane=(candidate:Candidate)=>candidate.offer?"OFFER":candidate.stage;
export default function HiringPipelinePreview({jobs,jobId,onJobChange}:{jobs:JobOption[];jobId:string;onJobChange:(id:string)=>void}){
 const [candidates,setCandidates]=useState(demoCandidates);
 const [query,setQuery]=useState(""); const [source,setSource]=useState("all"); const [selected,setSelected]=useState<string|null>(null);
 const [dragged,setDragged]=useState<string|null>(null); const [dropTarget,setDropTarget]=useState<string|null>(null); const [notice,setNotice]=useState("");
 const dialog=useRef<HTMLDialogElement>(null); const job=jobs.find(item=>item.id===jobId)??jobs[0];
 const scoped=candidates.filter(candidate=>candidate.job===job.id);
 const sources=[...new Set(scoped.map(candidate=>candidate.source))];
 const visible=useMemo(()=>candidates.filter(candidate=>candidate.job===job.id&&(source==="all"||candidate.source===source)&&`${candidate.name} ${candidate.title} ${candidate.skills.join(" ")}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())),[candidates,job.id,query,source]);
 const detail=visible.find(candidate=>candidate.id===selected);
 useEffect(()=>{if(detail&&!dialog.current?.open)dialog.current?.showModal();if(!detail&&dialog.current?.open)dialog.current?.close();},[detail]);
 const switchJob=(id:string)=>{onJobChange(id);setSelected(null);setQuery("");setSource("all");setNotice("");};
 const transition=(candidate:Candidate,target:"NEW"|"SCREEN")=>{
  if(!((candidate.stage==="NEW"&&target==="SCREEN")||(candidate.stage==="SCREEN"&&target==="NEW")))return;
  setCandidates(current=>current.map(item=>item.id===candidate.id?{...item,stage:target,days:0}:item));
  setNotice(`Đã chuyển thử ${candidate.name} sang ${target==="SCREEN"?"Sơ loại":"Mới ứng tuyển"}. Chỉ thay đổi dữ liệu demo trong trang.`);
 };
 const dragging=scoped.find(candidate=>candidate.id===dragged);
 const validDrop=(id:string)=>Boolean(dragging&&((dragging.stage==="NEW"&&id==="SCREEN")||(dragging.stage==="SCREEN"&&id==="NEW")));
 return <section className="ap-preview" aria-label="Hiring Pipeline thử nghiệm">
  <div className="ap-job-bar"><span className="ap-job-symbol"><BriefcaseBusiness size={22}/></span><div className="ap-job-select"><label htmlFor="ap-job">ĐANG XEM PIPELINE CỦA JOB</label><select id="ap-job" value={job.id} onChange={event=>switchJob(event.target.value)}>{jobs.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select><span>{job.code}<i>•</i>{job.unit}</span></div><div className="ap-team"><span className="am-avatar">P</span><div><small>TA phụ trách · Demo</small><b>Phúc Phạm</b></div></div></div>
  <div className="ap-summary" aria-label="Tổng quan Job đang chọn">
   <div><span className="ap-summary-icon blue"><UsersRound size={19}/></span><span><small>Tổng hồ sơ</small><b>{scoped.length}</b></span></div>
   <div><span className="ap-summary-icon purple"><SlidersHorizontal size={19}/></span><span><small>Đang xét tuyển</small><b>{scoped.filter(item=>!["HIRED","REJECTED"].includes(item.stage)).length}</b></span></div>
   <div><span className="ap-summary-icon amber"><CalendarDays size={19}/></span><span><small>Đang phỏng vấn</small><b>{scoped.filter(item=>item.stage==="INTERVIEW"&&!item.offer).length}</b></span></div>
   <div><span className="ap-summary-icon green"><CheckCheck size={19}/></span><span><small>Đã tuyển</small><b>{scoped.filter(item=>item.stage==="HIRED").length}</b></span></div>
  </div>
  <div className="ap-board-section"><div className="ap-board-heading"><div><h2>Tiến độ tuyển dụng <span>{scoped.length} hồ sơ</span></h2><p>Chọn thẻ để xem chi tiết. Có thể kéo thử giữa Mới ứng tuyển và Sơ loại.</p></div><button className="ap-reset" onClick={()=>{setCandidates(demoCandidates);setSelected(null);setNotice("Đã khôi phục dữ liệu demo ban đầu.");}}><RotateCcw size={14}/> Đặt lại demo</button></div>
   <div className="ap-toolbar"><label className="am-search"><Search size={17}/><input aria-label="Tìm ứng viên trong pipeline" placeholder="Tìm ứng viên, chức danh, kỹ năng…" value={query} onChange={event=>{setQuery(event.target.value);setSelected(null);}}/></label><label className="ap-source-filter">Nguồn<select aria-label="Lọc nguồn ứng viên" value={source} onChange={event=>{setSource(event.target.value);setSelected(null);}}><option value="all">Tất cả nguồn</option>{sources.map(item=><option key={item}>{item}</option>)}</select></label><span className="ap-result-count">Hiển thị {visible.length} / {scoped.length} hồ sơ</span></div>
   <p className="ap-notice" role="status" aria-live="polite">{notice||"Dữ liệu minh họa · SLA vòng là mục tiêu tham khảo, chưa tính thời gian thực."}</p>
   <div className="ap-board-scroll" role="region" aria-label="Các cột tuyển dụng, cuộn ngang để xem thêm" tabIndex={0}><div className="ap-board">{columns.map(column=>{
    const items=visible.filter(candidate=>lane(candidate)===column.id);
    return <section key={column.id} aria-label={`${column.name}: ${items.length} hồ sơ`} className={`ap-column ${column.tone} ${dropTarget===column.id?"ap-drop-active":""}`} onDragOver={event=>{if(validDrop(column.id)){event.preventDefault();setDropTarget(column.id);}}} onDragLeave={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setDropTarget(null);}} onDrop={event=>{event.preventDefault();if(dragging&&validDrop(column.id))transition(dragging,column.id as "NEW"|"SCREEN");setDragged(null);setDropTarget(null);}}>
     <header className="ap-column-head"><div><i/><h3>{column.name}</h3><span>{items.length}</span></div><small>{column.target}</small></header>
     <div className="ap-cards">{items.map(candidate=><button type="button" key={candidate.id} className="ap-candidate" draggable={candidate.stage==="NEW"||candidate.stage==="SCREEN"} onDragStart={event=>{event.dataTransfer.effectAllowed="move";event.dataTransfer.setData("text/plain",candidate.id);setDragged(candidate.id);}} onDragEnd={()=>{setDragged(null);setDropTarget(null);}} onClick={()=>setSelected(candidate.id)}>
      <div className="ap-candidate-top"><span className={`ap-avatar ${column.tone}`}>{candidate.initials}</span><span className="ap-candidate-person"><b>{candidate.name}</b><small>{candidate.company}</small></span>{["NEW","SCREEN"].includes(candidate.stage)&&<GripVertical size={15} className="ap-grip"/>}</div><strong className="ap-role">{candidate.title}</strong><div className="ap-skills">{candidate.skills.map(skill=><span key={skill}>{skill}</span>)}</div><div className="ap-next"><span>{candidate.offer?"CHỜ PHẢN HỒI":candidate.stage==="INTERVIEW"?"VÒNG PHỎNG VẤN":"BƯỚC TIẾP THEO"}</span><p>{candidate.next}</p></div><footer><span className="ap-source">{candidate.source}</span><span className="ap-age"><Clock3 size={12}/>{candidate.days} ngày</span></footer>
     </button>)}{items.length===0&&<div className="ap-empty-lane"><span>Chưa có hồ sơ</span><small>{query||source!=="all"?"trong kết quả lọc":"ở bước này"}</small></div>}</div>
    </section>;
   })}</div></div>
   {visible.length===0&&<div className="ap-no-results">{scoped.length?"Không tìm thấy hồ sơ phù hợp. Hãy đổi từ khóa hoặc nguồn.":"Job này chưa có ứng viên demo. Chọn Job TEST ONLY để xem pipeline có dữ liệu."}</div>}
   <div className="ap-board-footer"><span><i/> Offer hiển thị riêng theo đề nghị; không đổi stage dữ liệu.</span><span>Cuộn ngang để xem tất cả các bước <ArrowRight size={13}/></span></div>
  </div>
  <dialog ref={dialog} className="ap-detail-dialog" onCancel={()=>setSelected(null)} onClose={()=>setSelected(null)} onClick={event=>{if(event.target===event.currentTarget)setSelected(null);}} aria-labelledby="ap-detail-title">{detail&&<div className="ap-detail-content">
   <header><span>HỒ SƠ ỨNG VIÊN · DEMO</span><button aria-label="Đóng chi tiết ứng viên" onClick={()=>setSelected(null)}><X size={19}/></button></header><div className="ap-detail-person"><span className="ap-avatar purple">{detail.initials}</span><div><h2 id="ap-detail-title">{detail.name}</h2><p>{detail.title}</p></div></div><div className="ap-detail-stage">{job.code}<ChevronRight size={14}/><b>{columns.find(column=>column.id===lane(detail))?.name}</b></div><dl><div><dt>Công ty hiện tại</dt><dd>{detail.company}</dd></div><div><dt>Nguồn ứng viên</dt><dd>{detail.source}</dd></div><div><dt>TA phụ trách</dt><dd>Phúc · Demo</dd></div><div><dt>Thời gian ở bước này</dt><dd>{detail.days} ngày · Minh họa</dd></div></dl><h3>Kỹ năng nổi bật</h3><div className="ap-skills">{detail.skills.map(skill=><span key={skill}>{skill}</span>)}</div><h3>Bước tiếp theo</h3><div className="ap-detail-next"><CalendarDays size={18}/><p>{detail.next}</p></div><h3>Lịch sử minh họa</h3><ol className="ap-timeline"><li><b>Hồ sơ đang ở {columns.find(column=>column.id===lane(detail))?.name}</b><span>Phúc · dữ liệu mô phỏng</span></li><li><b>Thêm hồ sơ vào Job</b><span>Nguồn {detail.source}</span></li></ol>{(detail.stage==="NEW"||detail.stage==="SCREEN")&&<button className="ap-move" onClick={()=>transition(detail,detail.stage==="NEW"?"SCREEN":"NEW")}>Chuyển thử sang {detail.stage==="NEW"?"Sơ loại":"Mới ứng tuyển"}<ArrowRight size={16}/></button>}<p className="ap-detail-disclaimer">Thao tác thử chỉ có hiệu lực trong trang này. Tải lại trang sẽ khôi phục dữ liệu ban đầu.</p>
  </div>}</dialog>
 </section>;
}
