"use client";

import { useMemo, useState } from "react";
import { Badge, Button, Card } from "@astryxdesign/core";
import { Theme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral/built";
import { ArrowRight, BriefcaseBusiness, Check, CircleAlert, Globe2, Layers3, Search, ShieldCheck, UsersRound } from "lucide-react";
import "./page.css";

type Job = {
  id: string;
  title: string;
  code: string;
  unit: string;
  functionGroup: string;
  request: string;
  reqDate: string;
  level: string;
  priority: string;
  status: "Hiring" | "Draft";
  sla: string;
  candidates: number;
  stages: string;
  source: string;
};

const demoJobs: Job[] = [
  { id: "ats-app", title: "[TEST ONLY] ATS V2 Application E2E 20261011", code: "TEST-ATS-APP-20261011", unit: "Chưa có BU", functionGroup: "Test · QA", request: "Chưa xác định", reqDate: "—", level: "Level —", priority: "Chưa có ưu tiên", status: "Hiring", sla: "Thiếu Level / Function / Season", candidates: 6, stages: "Mới 1 · Sơ loại 0 · Phỏng vấn 0 · Đã tuyển 0", source: "Nguồn (1)" },
  { id: "codex-admin", title: "[TEST ONLY] Codex Admin E2E 20261107", code: "TEST-CODEX-ADMIN-20261107", unit: "TEST ONLY", functionGroup: "Chưa phân nhóm · Test City", request: "Chưa xác định", reqDate: "—", level: "Level —", priority: "Chưa có ưu tiên", status: "Hiring", sla: "Thiếu Level / Function / Season", candidates: 1, stages: "Mới 1 · Sơ loại 0 · Phỏng vấn 0 · Đã tuyển 0", source: "Nguồn (1)" },
  { id: "marketing", title: "Senior Product Marketing", code: "Chưa có mã Job", unit: "Marketing", functionGroup: "Chưa phân nhóm · HCM", request: "Chưa xác định", reqDate: "—", level: "Level —", priority: "Chưa có ưu tiên", status: "Draft", sla: "Thiếu Level / Function / Season", candidates: 0, stages: "Chưa có dữ liệu ứng viên", source: "Nguồn: chưa có dữ liệu" },
  { id: "embedded", title: "Synthetic Software Engineer", code: "Chưa có mã Job", unit: "Test Unit", functionGroup: "Chưa phân nhóm · Test City", request: "Chưa xác định", reqDate: "—", level: "Level 3", priority: "Chưa có ưu tiên", status: "Draft", sla: "Thiếu Function / Season", candidates: 0, stages: "Chưa có dữ liệu ứng viên", source: "Nguồn: chưa có dữ liệu" },
];

function StatusBadge({ status }: { status: Job["status"] }) {
  return <Badge variant={status === "Hiring" ? "success" : "warning"} label={<span className="am-status"><i />{status === "Hiring" ? "Đang tuyển" : "Bản nháp"}</span>} />;
}

export default function AstryxMasterPreview() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"All" | Job["status"]>("All");
  const [selected, setSelected] = useState("codex-admin");
  const filtered = useMemo(() => demoJobs.filter((job) =>
    (status === "All" || job.status === status) &&
    `${job.title} ${job.code} ${job.unit} ${job.functionGroup}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  ), [query, status]);

  return <Theme theme={neutralTheme} mode="light">
    <div className="astryx-master-demo">
      <aside className="am-sidebar">
        <div className="am-brand"><span className="am-brand-icon"><Layers3 size={21} /></span><span><b>ATS Workspace</b><small>Recruiting console</small></span></div>
        <p className="am-nav-label">KHÔNG GIAN TUYỂN DỤNG</p>
        <button className="am-nav active"><BriefcaseBusiness size={18} /><span>Vị trí tuyển dụng</span><b>4</b></button>
        <button className="am-nav"><UsersRound size={18} /><span>Talent Pool</span></button>
        <button className="am-nav"><ShieldCheck size={18} /><span>Quản trị & quyền</span></button>
        <div className="am-sidebar-bottom"><span className="am-online" /> ATS V2 · Bản xem thử <small>Dữ liệu minh họa, không kết nối Supabase</small></div>
      </aside>

      <main className="am-main">
        <header className="am-topbar"><div className="am-breadcrumb">Tuyển dụng <span>/</span> <b>1.1 Bảng Master</b></div><div className="am-user"><Globe2 size={16} /> Tiếng Việt <span className="am-avatar">P</span> Phúc · Admin</div></header>
        <div className="am-content">
          <section className="am-heading"><div><span className="am-eyebrow">ATS WORKSPACE</span><h1>Quản lý Job & tuyển dụng</h1><p>Theo dõi vị trí, trạng thái và tiến độ ứng viên trong một bảng dễ quét.</p></div><Button label="Tạo Job" variant="primary" size="md" icon={<BriefcaseBusiness size={16} />} /></section>
          <div className="am-view-tabs"><button className="selected"><Layers3 size={16} /> 1.1 Bảng Master <Badge variant="purple" label="4 Job" /></button><button><UsersRound size={16} /> 1.2 Hiring Pipeline <Badge variant="neutral" label="8 UV" /></button><span className="am-tabs-spacer" /><span className="am-demo-pill"><Check size={14} /> Giao diện thử Astryx</span></div>

          <section className="am-stats" aria-label="Tổng quan Job">
            <Card className="am-stat"><div className="am-stat-head"><span>Vị trí đã tải</span><span className="am-stat-icon purple"><BriefcaseBusiness size={17} /></span></div><strong>4</strong><small>Trong danh sách bạn được xem</small></Card>
            <Card className="am-stat"><div className="am-stat-head"><span>Đang tuyển</span><span className="am-stat-icon green"><UsersRound size={17} /></span></div><strong>2</strong><small>Sẵn sàng nhận ứng viên</small></Card>
            <Card className="am-stat"><div className="am-stat-head"><span>Cần hoàn thiện</span><span className="am-stat-icon amber"><CircleAlert size={17} /></span></div><strong>2</strong><small>Job nháp hoặc thiếu thông tin SLA</small></Card>
          </section>

          <Card className="am-table-card" padding={0}>
            <div className="am-table-head"><div><h2>Danh sách vị trí</h2><p>Thông tin quan trọng được gom theo từng Job.</p></div><Badge variant="purple" label={`${filtered.length} Job`} /></div>
            <div className="am-toolbar">
              <label className="am-search"><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm theo tên vị trí, mã Job hoặc đơn vị…" aria-label="Tìm Job" /></label>
              <div className="am-filters" role="group" aria-label="Lọc trạng thái">
                {(["All", "Draft", "Hiring"] as const).map((item) => <button key={item} className={status === item ? "active" : ""} aria-pressed={status === item} onClick={() => setStatus(item)}>{item === "All" ? "Tất cả" : item === "Draft" ? "Bản nháp" : "Đang tuyển"}<span>{item === "All" ? demoJobs.length : demoJobs.filter((job) => job.status === item).length}</span></button>)}
              </div>
            </div>
            <div className="am-table-wrap"><table className="am-table"><thead><tr><th>VỊ TRÍ & MÃ JOB</th><th>ĐƠN VỊ & CHỨC NĂNG</th><th>YÊU CẦU</th><th>LEVEL & ƯU TIÊN</th><th>TRẠNG THÁI</th><th>SLA & MÙA TUYỂN</th><th>ỨNG VIÊN & TIẾN ĐỘ</th></tr></thead>
              <tbody>{filtered.map((job) => <tr key={job.id} className={selected === job.id ? "selected" : ""} onClick={() => setSelected(job.id)}>
                <td><div className="am-job-title"><span className="am-job-icon"><BriefcaseBusiness size={17} /></span><div><strong>{job.title}</strong><small>{job.code}</small></div></div></td>
                <td><strong>{job.unit}</strong><small>{job.functionGroup}</small></td>
                <td><strong>{job.request}</strong><small>Req date: {job.reqDate}</small></td>
                <td><strong>{job.level}</strong><small>{job.priority}</small></td>
                <td><StatusBadge status={job.status} /></td>
                <td><span className="am-muted">{job.sla}</span><small>Mùa tuyển dụng: —</small></td>
                <td><strong>{job.candidates} ứng viên</strong><small>{job.stages}</small><button className="am-source">{job.source}</button><Button label="Mở Pipeline" variant="secondary" size="sm" endContent={<ArrowRight size={14} />} className="am-pipeline" /></td>
              </tr>)}</tbody></table>{filtered.length === 0 && <div className="am-empty">Không tìm thấy Job phù hợp. Thử đổi từ khóa hoặc trạng thái.</div>}</div>
            <footer className="am-table-footer"><ShieldCheck size={15} /> Thông tin hiển thị theo quyền của tài khoản · Bản minh họa chỉ chứa dữ liệu mẫu <span>{filtered.length} / {demoJobs.length} Job</span></footer>
          </Card>
          <div className="am-note"><b>Đang xem bản thử</b><span>Đây là bản thiết kế cô lập để đánh giá giao diện. Không ghi dữ liệu và không ảnh hưởng đến ATS hiện tại.</span></div>
        </div>
      </main>
    </div>
  </Theme>;
}
