"use client";

import { useMemo, useState } from "react";
import { Badge, Button, Card } from "@astryxdesign/core";
import { Theme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral/built";
import { ArrowRight, BriefcaseBusiness, Check, CircleAlert, Globe2, Layers3, Search, ShieldCheck, UsersRound, Plus, TrendingUp } from "lucide-react";
import "./page.css";

type Job = { id:string; title:string; code:string; unit:string; functionGroup:string; request:string; reqDate:string; level:string; priority:string; status:"Hiring"|"Draft"; sla:string; candidates:number; stages:string; source:string };

const demoJobs: Job[] = [
 {id:"ats-app",title:"[TEST ONLY] ATS V2 Application E2E 20261011",code:"TEST-ATS-APP-20261011",unit:"Chưa có BU",functionGroup:"Test · QA",request:"Chưa xác định",reqDate:"—",level:"—",priority:"Chưa có ưu tiên",status:"Hiring",sla:"Thiếu Level / Function / Season",candidates:6,stages:"Mới 1 · Sơ loại 0 · Phỏng vấn 0 · Đã tuyển 0",source:"Nguồn (1)"},
 {id:"codex-admin",title:"[TEST ONLY] Codex Admin E2E 20261107",code:"TEST-CODEX-ADMIN-20261107",unit:"TEST ONLY",functionGroup:"Chưa phân nhóm · Test City",request:"Chưa xác định",reqDate:"—",level:"—",priority:"Chưa có ưu tiên",status:"Hiring",sla:"Thiếu Level / Function / Season",candidates:1,stages:"Mới 1 · Sơ loại 0 · Phỏng vấn 0 · Đã tuyển 0",source:"Nguồn (1)"},
 {id:"marketing",title:"Senior Product Marketing",code:"Chưa có mã Job",unit:"Marketing",functionGroup:"Chưa phân nhóm · HCM",request:"Chưa xác định",reqDate:"—",level:"—",priority:"Chưa có ưu tiên",status:"Draft",sla:"Thiếu Level / Function / Season",candidates:0,stages:"Chưa có dữ liệu ứng viên",source:"Chưa có nguồn"},
 {id:"embedded",title:"Synthetic Software Engineer",code:"Chưa có mã Job",unit:"Test Unit",functionGroup:"Chưa phân nhóm · Test City",request:"Chưa xác định",reqDate:"—",level:"3",priority:"Chưa có ưu tiên",status:"Draft",sla:"Thiếu Function / Season",candidates:0,stages:"Chưa có dữ liệu ứng viên",source:"Chưa có nguồn"},
];

function StatusBadge({status}:{status:Job["status"]}) {
 return <Badge variant={status==="Hiring"?"success":"warning"} label={<span className="am-status"><i />{status==="Hiring"?"Đang tuyển":"Bản nháp"}</span>} />;
}

export default function AstryxMasterPreview() {
 const [query,setQuery]=useState("");
 const [status,setStatus]=useState<"All"|Job["status"]>("All");
 const [selected,setSelected]=useState("codex-admin");
 const filtered=useMemo(()=>demoJobs.filter(job=>(status==="All"||job.status===status)&&`${job.title} ${job.code} ${job.unit} ${job.functionGroup}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())),[query,status]);
 return <Theme theme={neutralTheme} mode="light">
  <div className="astryx-master-demo">
   <aside className="am-sidebar">
    <div className="am-brand"><span className="am-brand-icon"><Layers3 size={20}/></span><span><b>ATS Workspace</b><small>Recruiting console</small></span></div>
    <p className="am-nav-label">WORKSPACE</p>
    <button className="am-nav active"><BriefcaseBusiness size={18}/><span>Vị trí tuyển dụng</span><b>4</b></button>
    <button className="am-nav"><UsersRound size={18}/><span>Kho ứng viên</span></button>
    <button className="am-nav"><ShieldCheck size={18}/><span>Quản trị & quyền</span></button>
    <div className="am-sidebar-bottom"><span className="am-online"/> ATS V2 · Bản xem thử<small>Dữ liệu minh họa · Không kết nối Supabase</small></div>
   </aside>
   <main className="am-main">
    <header className="am-topbar"><div className="am-breadcrumb">Tuyển dụng <span>/</span><b>Bảng Master</b></div><div className="am-user"><Globe2 size={16}/> Tiếng Việt <span className="am-avatar">P</span> Phúc · Admin</div></header>
    <div className="am-content">
     <section className="am-heading"><div><span className="am-eyebrow">ATS WORKSPACE <i>PREVIEW</i></span><h1>Vị trí tuyển dụng</h1><p>Theo dõi nhu cầu, tình trạng và tiến độ tuyển dụng tại một nơi.</p></div><Button label="Tạo Job" variant="primary" size="md" icon={<Plus size={16}/>}/></section>
     <div className="am-view-tabs"><button className="selected"><Layers3 size={16}/> 1.1 Bảng Master <Badge variant="purple" label="4 Job"/></button><button><UsersRound size={16}/> 1.2 Hiring Pipeline <Badge variant="neutral" label="8 UV"/></button><span className="am-tabs-spacer"/><span className="am-demo-pill"><Check size={14}/> Bản thử · dữ liệu giả</span></div>

     <section className="am-bento" aria-label="Tổng quan tuyển dụng">
      <Card className="am-bento-card am-bento-total"><div className="am-bento-top"><span>VỊ TRÍ ĐƯỢC PHÂN QUYỀN</span><span className="am-stat-icon purple"><BriefcaseBusiness size={17}/></span></div><strong>4</strong><p>Job trong danh sách hiện tại</p><div className="am-bento-foot"><span><i className="dot green"/> 2 đang tuyển</span><span><i className="dot amber"/> 2 bản nháp</span></div></Card>
      <Card className="am-bento-card am-bento-health"><div className="am-health-copy"><div className="am-bento-top"><span>TÌNH HÌNH TUYỂN DỤNG</span><span className="am-stat-icon green"><TrendingUp size={17}/></span></div><strong>7 <small>ứng viên</small></strong><p>Đã có hồ sơ trong 2 Job đang tuyển</p></div><div className="am-stage-bars"><div><span>Mới</span><b>2</b><i><em style={{width:"34%"}}/></i></div><div><span>Sơ loại</span><b>0</b><i><em style={{width:"0%"}}/></i></div><div><span>Phỏng vấn</span><b>0</b><i><em style={{width:"0%"}}/></i></div><div><span>Offer</span><b>0</b><i><em style={{width:"0%"}}/></i></div></div></Card>
      <Card className="am-bento-card am-bento-attention"><div className="am-bento-top"><span>CẦN HOÀN THIỆN</span><span className="am-stat-icon amber"><CircleAlert size={17}/></span></div><strong>2</strong><p>Job thiếu trường dữ liệu SLA</p><span className="am-attention-link">Xem các Job bên dưới <ArrowRight size={13}/></span></Card>
     </section>

     <Card className="am-table-card" padding={0}>
      <div className="am-table-head"><div><div className="am-table-title"><h2>Danh sách Job</h2><Badge variant="purple" label={`${filtered.length}`}/></div><p>Mở một Job để xem hồ sơ và tiến độ chi tiết.</p></div><span className="am-table-caption"><ShieldCheck size={14}/> Hiển thị theo quyền tài khoản</span></div>
      <div className="am-toolbar">
       <label className="am-search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Tìm tên vị trí hoặc mã Job…" aria-label="Tìm Job"/></label>
       <div className="am-filters" role="group" aria-label="Lọc trạng thái">{(["All","Hiring","Draft"] as const).map(item=><button key={item} className={status===item?"active":""} aria-pressed={status===item} onClick={()=>setStatus(item)}>{item==="All"?"Tất cả":item==="Hiring"?"Đang tuyển":"Bản nháp"}<span>{item==="All"?demoJobs.length:demoJobs.filter(j=>j.status===item).length}</span></button>)}</div>
       <button className="am-filter-more">Bộ lọc <span>＋</span></button>
      </div>
      <div className="am-table-wrap"><table className="am-table"><thead><tr><th>JOB & ĐỊNH DANH</th><th>ĐƠN VỊ & CHỨC NĂNG</th><th>YÊU CẦU</th><th>TRẠNG THÁI & SLA</th><th>ỨNG VIÊN & FUNNEL</th></tr></thead>
       <tbody>{filtered.map(job=><tr key={job.id} className={selected===job.id?"selected":""} onClick={()=>setSelected(job.id)}>
        <td><div className="am-job-title"><span className="am-job-icon"><BriefcaseBusiness size={16}/></span><div><strong>{job.title}</strong><small>{job.code}</small><small>Level {job.level} · {job.priority}</small></div></div></td>
        <td><strong>{job.unit}</strong><small>{job.functionGroup}</small></td>
        <td><strong>{job.request}</strong><small>Req date · {job.reqDate}</small></td>
        <td><StatusBadge status={job.status}/><span className="am-muted">{job.sla}</span></td>
        <td><div className="am-candidates"><strong>{job.candidates}</strong><span>ứng viên</span></div><small>{job.stages}</small><button className="am-source">{job.source}</button><Button label="Pipeline" variant="secondary" size="sm" endContent={<ArrowRight size={14}/>} className="am-pipeline"/></td>
       </tr>)}</tbody></table>{filtered.length===0&&<div className="am-empty">Không tìm thấy Job phù hợp. Thử đổi từ khóa hoặc trạng thái.</div>}</div>
      <footer className="am-table-footer"><span>Dữ liệu mẫu · Không ghi vào ATS</span><span>{filtered.length} / {demoJobs.length} Job</span></footer>
     </Card>
     <div className="am-note"><b>Preview độc lập</b><span>Trang thử nghiệm chỉ để đánh giá giao diện. Không ảnh hưởng màn Master hiện tại.</span></div>
    </div>
   </main>
  </div>
 </Theme>;
}