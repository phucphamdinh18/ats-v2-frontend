import { friendlyError, getCopy, type Locale } from "./i18n";

// Explicit interface copy only. Candidate names, CVs, job titles and API payloads
// are never translated. Placeholders keep data separate from interface wording.
export const uiCopy: Record<string, readonly [string, string]> = {
  "Đang cập nhật số liệu…": ["Đang cập nhật số liệu…", "Updating totals…"],
  "Đã lưu thay đổi nhưng chưa tải lại được số liệu tổng quan.": [
    "Đã lưu thay đổi nhưng chưa tải lại được số liệu tổng quan.",
    "Your changes were saved, but the overview totals could not be refreshed.",
  ],
  "Tải lại số liệu": ["Tải lại số liệu", "Refresh totals"],
  "Link CV Google Drive": ["Link CV Google Drive", "Google Drive CV link"],
  "Thêm ứng viên": ["Thêm ứng viên", "Add candidate"],
  "Theo dõi đề nghị": ["Theo dõi đề nghị", "Track offers"],
  "Hoàn tất tuyển dụng": ["Hoàn tất tuyển dụng", "Hiring complete"],
  "Hồ sơ đã kết thúc": ["Hồ sơ đã kết thúc", "Closed applications"],
  Hủy: ["Hủy", "Cancel"],
  "Thông tin bổ sung": ["Thông tin bổ sung", "Additional details"],
  "1.3 Quản lý Job": ["1.3 Quản lý Job", "1.3 Manage jobs"],
  "Quản lý": ["Quản lý", "Manage"],
  "Thao tác cho Job đã chọn": [
    "Thao tác cho Job đã chọn",
    "Actions for the selected job",
  ],
  "Tạo Job mới hoặc chọn Quản lý để cập nhật một Job.": [
    "Tạo Job mới hoặc chọn Quản lý để cập nhật một Job.",
    "Create a job or choose Manage to update a job.",
  ],
  "Đã tạo Job nháp và lưu yêu cầu cho “{0}”. Chọn Quản lý rồi Mở tuyển khi sẵn sàng.":
    [
      "Đã tạo Job nháp và lưu yêu cầu cho “{0}”. Chọn Quản lý rồi Mở tuyển khi sẵn sàng.",
      "Draft job and requirements saved for “{0}”. Choose Manage, then Open for hiring when ready.",
    ],
  "Thử tên khác hoặc đổi trạng thái.": [
    "Thử tên khác hoặc đổi trạng thái.",
    "Try another name or change the status filter.",
  ],
  "Không tìm thấy Job phù hợp": [
    "Không tìm thấy Job phù hợp",
    "No matching jobs",
  ],
  "Người được làm việc trên Job này": [
    "Người được làm việc trên Job này",
    "Who can work on this job",
  ],
  "Chưa xác định thời hạn": ["Chưa xác định thời hạn", "Hiring target not set"],
  "Chưa có cấp độ": ["Chưa có cấp độ", "Seniority not set"],
  "Theo trạng thái hiện tại": [
    "Theo trạng thái hiện tại",
    "See current status",
  ],
  "Đang nhận ứng viên": ["Đang nhận ứng viên", "Accepting candidates"],
  "Đội ngũ & quyền truy cập": ["Đội ngũ & quyền truy cập", "Team & access"],
  "Trạng thái tuyển dụng": ["Trạng thái tuyển dụng", "Hiring status"],
  "Tất cả trạng thái": ["Tất cả trạng thái", "All statuses"],
  "Tìm tên vị trí hoặc mã…": [
    "Tìm tên vị trí hoặc mã…",
    "Search by title or reference…",
  ],
  "Tìm Job": ["Tìm Job", "Search jobs"],
  "Thành viên cần đăng nhập ATS ít nhất một lần trước khi được phân công.": [
    "Thành viên cần đăng nhập ATS ít nhất một lần trước khi được phân công.",
    "Teammates must sign in to ATS at least once before you can assign them.",
  ],
  "Phân công chỉ quyết định ai được làm việc trên Job này. Thao tác này không mở tuyển và không cấp quyền Admin toàn hệ thống.":
    [
      "Phân công chỉ quyết định ai được làm việc trên Job này. Thao tác này không mở tuyển và không cấp quyền Admin toàn hệ thống.",
      "Assignments control who can work on this job. They do not open hiring or grant workspace admin access.",
    ],
  "Lưu yêu cầu": ["Lưu yêu cầu", "Save requirements"],
  "Chỉnh yêu cầu và thời hạn tuyển dụng cho Job đang chọn. Lưu thông tin không đổi trạng thái Job hoặc quyền của đội ngũ.":
    [
      "Chỉnh yêu cầu và thời hạn tuyển dụng cho Job đang chọn. Lưu thông tin không đổi trạng thái Job hoặc quyền của đội ngũ.",
      "Update requirements and hiring targets for this job. Saving does not change hiring status or team access.",
    ],
  "Mở tuyển cho phép tiếp nhận ứng viên. Thao tác này không phân công hay cấp quyền cho thành viên.":
    [
      "Mở tuyển cho phép tiếp nhận ứng viên. Thao tác này không phân công hay cấp quyền cho thành viên.",
      "Opening hiring allows this job to receive candidates. It does not assign teammates or grant access.",
    ],
  "Lưu Job nháp": ["Lưu Job nháp", "Save draft job"],
  "Lưu tiếp yêu cầu": ["Lưu tiếp yêu cầu", "Continue saving requirements"],
  "Thông tin Job": ["Thông tin Job", "Job details"],
  "Job nháp đã được lưu. Hoàn tất phần yêu cầu bên dưới; thử lại sẽ không tạo thêm Job.":
    [
      "Job nháp đã được lưu. Hoàn tất phần yêu cầu bên dưới; thử lại sẽ không tạo thêm Job.",
      "The draft job is saved. Complete the requirements below; retrying will continue this draft without creating another job.",
    ],
  "Nhập thông tin và yêu cầu tại đây. Lưu sẽ tạo Job nháp; Job chỉ nhận ứng viên sau khi bạn chọn Mở tuyển.":
    [
      "Nhập thông tin và yêu cầu tại đây. Lưu sẽ tạo Job nháp; Job chỉ nhận ứng viên sau khi bạn chọn Mở tuyển.",
      "Enter job details and requirements here. Saving creates a draft; the job accepts candidates only after you choose Open for hiring.",
    ],
  "Chỉnh yêu cầu": ["Chỉnh yêu cầu", "Edit requirements"],
  "Tạo Job": ["Tạo Job", "Create job"],
  "Tiếp tục Job nháp": ["Tiếp tục Job nháp", "Continue draft job"],
  "Tạo Job mới hoặc chọn thao tác ngay trên từng dòng. Mở tuyển và phân công là hai việc riêng.":
    [
      "Tạo Job mới hoặc chọn thao tác ngay trên từng dòng. Mở tuyển và phân công là hai việc riêng.",
      "Create a job or choose an action on its row. Opening hiring and assigning access are separate actions.",
    ],
  "Danh sách Job": ["Danh sách Job", "All jobs"],
  "Chưa mở tuyển": ["Chưa mở tuyển", "Not open for hiring"],
  "Chọn thông tin": ["Chọn thông tin", "Choose an option"],
  "Quản lý Job": ["Quản lý Job", "Manage jobs"],
  MOVED: ["Đã chuyển vòng", "Stage changed"],
  APPLICATION_CREATED: ["Đã thêm hồ sơ", "Application added"],
  APPLICATION_STAGE_CHANGED: ["Đã chuyển vòng", "Stage changed"],
  "Cập nhật hồ sơ": ["Cập nhật hồ sơ", "Application updated"],

  sang: ["sang", "to"],
  "Hiring Pipeline": ["Tiến độ tuyển dụng", "Hiring Pipeline"],
  "Job overview and hiring progress": [
    "Tổng quan vị trí và tiến độ tuyển dụng",
    "Job overview and hiring progress",
  ],
  "Kho ứng viên đã duyệt": ["Kho ứng viên đã duyệt", "Approved candidates"],
  "JD tuyển dụng": ["JD tuyển dụng", "Job descriptions"],
  "Hàng chờ duyệt mô tả công việc": [
    "Hàng chờ duyệt mô tả công việc",
    "Job descriptions waiting for review",
  ],
  "Quản trị & quyền": ["Quản lý Job", "Manage jobs"],
  "Quản lý Job và phân quyền": [
    "Quản lý Job và phân quyền",
    "Manage jobs and team access",
  ],
  "Đăng nhập vào ATS": ["Đăng nhập vào ATS", "Sign in to ATS"],
  "Email thử nghiệm": ["Email thử nghiệm", "Test email"],
  "Mật khẩu thử nghiệm": ["Mật khẩu thử nghiệm", "Test password"],
  "Đang đăng nhập…": ["Đang đăng nhập…", "Signing in…"],
  "Đăng nhập thử": ["Đăng nhập thử", "Test sign-in"],
  "Ẩn đăng nhập thử nghiệm": ["Ẩn đăng nhập thử nghiệm", "Hide test sign-in"],
  "Mở đăng nhập thử nghiệm cục bộ": [
    "Mở đăng nhập thử nghiệm cục bộ",
    "Open local test sign-in",
  ],
  "Talent Pool": ["Kho ứng viên", "Talent Pool"],
  "Mở rộng thanh điều hướng": ["Mở rộng thanh điều hướng", "Expand navigation"],
  "Thu gọn thanh điều hướng": [
    "Thu gọn thanh điều hướng",
    "Collapse navigation",
  ],
  "Mở rộng": ["Mở rộng", "Expand"],
  "Thu gọn menu": ["Thu gọn menu", "Collapse menu"],
  "Bảng Master": ["Bảng Master", "Job overview"],
  "Tìm Job hoặc màn hình…": [
    "Tìm Job hoặc màn hình…",
    "Search jobs and pages…",
  ],
  "Tìm trong ATS": ["Tìm trong ATS", "Search ATS"],
  "Kết quả tìm kiếm": ["Kết quả tìm kiếm", "Search results"],
  "Không tìm thấy Job hoặc màn hình phù hợp.": [
    "Không tìm thấy Job hoặc màn hình phù hợp.",
    "No matching jobs or pages.",
  ],
  "Tìm nhanh": ["Tìm nhanh", "Quick search"],
  "Chế độ thử trên máy này. Quyền Admin/TA vẫn được kiểm tra bằng dữ liệu thử.":
    [
      "Chế độ thử trên máy này. Quyền Admin/TA vẫn được kiểm tra bằng dữ liệu thử.",
      "Local test mode. Admin and recruiter access is checked against test data.",
    ],
  Preview: ["Bản xem thử", "Preview"],
  "Quản trị ATS": ["Quản lý Job & đội ngũ", "Jobs & team administration"],
  "Quản lý hồ sơ ứng viên đã được duyệt và đưa ứng viên vào Job phù hợp.": [
    "Quản lý hồ sơ ứng viên đã được duyệt và đưa ứng viên vào Job phù hợp.",
    "Manage approved candidate profiles and add candidates to suitable jobs.",
  ],
  "Kiểm tra, duyệt và theo dõi mô tả công việc trước khi tạo Job nháp.": [
    "Kiểm tra, duyệt và theo dõi mô tả công việc trước khi tạo Job nháp.",
    "Review job descriptions before creating a draft opening.",
  ],
  "Quản lý vị trí tuyển dụng và phân công đội ngũ của bạn.": [
    "Quản lý vị trí tuyển dụng và phân công đội ngũ của bạn.",
    "Manage job openings and assign your team.",
  ],
  "Ẩn hướng dẫn": ["Ẩn hướng dẫn", "Hide guide"],
  "Hiện hướng dẫn": ["Hiện hướng dẫn", "Show guide"],
  "Quản trị Job": ["Quản trị Job", "Manage jobs"],
  "Chế độ xem Job": ["Chế độ xem Job", "Job views"],
  "1.1 Bảng Master": ["1.1 Bảng Master", "1.1 Job overview"],
  Job: ["Vị trí", "Job"],
  "1.2 Hiring Pipeline": ["1.2 Tiến độ tuyển dụng", "1.2 Hiring Pipeline"],
  "Chọn Job": ["Chọn Job", "Choose a job"],
  "Tình hình tuyển dụng": ["Tình hình tuyển dụng", "Candidate overview"],
  "Hồ sơ trong các Job đã tải": [
    "Hồ sơ trong các Job đã tải",
    "Applications across loaded jobs",
  ],
  Mới: ["Mới", "New"],
  "Sơ loại": ["Sơ loại", "Screening"],
  "Phỏng vấn": ["Phỏng vấn", "Interview"],
  "Đã tuyển": ["Đã tuyển", "Hired"],
  "Cần hoàn thiện SLA": ["Cần hoàn thiện SLA", "Complete hiring targets"],
  "Job chưa xác định được SLA tổng": [
    "Job chưa xác định được SLA tổng",
    "Jobs without an overall hiring target",
  ],
  "Kiểm tra Level, nhóm chức năng và mùa tuyển dụng.": [
    "Kiểm tra Level, nhóm chức năng và mùa tuyển dụng.",
    "Check seniority, job function and hiring season.",
  ],
  "· Master": ["· Master", "· Overview"],
  "1. Định danh & vị trí": ["1. Định danh & vị trí", "1. Job & reference"],
  "2. Đơn vị & chức năng": [
    "2. Đơn vị & chức năng",
    "2. Department & function",
  ],
  "3. Loại yêu cầu & ngày Req": [
    "3. Loại yêu cầu & ngày Req",
    "3. Request & date",
  ],
  "4. Trạng thái & SLA": ["4. Trạng thái & SLA", "4. Status & hiring target"],
  "5. Ứng viên & nguồn": ["5. Ứng viên & nguồn", "5. Candidates & sources"],
  "Chọn Job {0}": ["Chọn Job {0}", "Choose job {0}"],
  "Chưa có ưu tiên": ["Chưa có ưu tiên", "No priority set"],
  "Chưa có BU": ["Chưa có BU", "No department set"],
  "Chưa phân nhóm": ["Chưa phân nhóm", "No function set"],
  "Thay thế": ["Thay thế", "Replacement"],
  "Tuyển mới": ["Tuyển mới", "New opening"],
  "Chưa xác định": ["Chưa xác định", "Not specified"],
  "Req:": ["Req:", "Requested:"],
  "Thiếu Level / Function / Season": [
    "Thiếu Level / Function / Season",
    "Complete seniority, function and season",
  ],
  "ngày làm việc": ["ngày làm việc", "working days"],
  "Chưa chọn mùa tuyển dụng": [
    "Chưa chọn mùa tuyển dụng",
    "No hiring season set",
  ],
  "ứng viên": ["ứng viên", "candidates"],
  NEW: ["Mới ứng tuyển", "New application"],
  "· Sơ loại": ["· Sơ loại", "· Screening"],
  "· Phỏng vấn": ["· Phỏng vấn", "· Interview"],
  "· Đã tuyển": ["· Đã tuyển", "· Hired"],
  "Nguồn (": ["Nguồn (", "Sources ("],
  "Nguồn: chưa có dữ liệu": ["Nguồn: chưa có dữ liệu", "No source data yet"],
  "Mở pipeline {0}": ["Mở pipeline {0}", "Open pipeline for {0}"],
  Pipeline: ["Tiến độ tuyển dụng", "Pipeline"],
  "Quay lại Bảng Master": ["Quay lại Bảng Master", "Back to job overview"],
  "Đang xem pipeline của Job": [
    "Đang xem pipeline của Job",
    "Pipeline for job",
  ],
  "Chọn Job cho Hiring Pipeline": [
    "Chọn Job cho Hiring Pipeline",
    "Choose a job for Hiring Pipeline",
  ],
  "Chưa có mã": ["Chưa có mã", "No reference yet"],
  "Chưa có bộ phận": ["Chưa có bộ phận", "No department set"],
  "Chưa có Job được cấp quyền": [
    "Chưa có Job được cấp quyền",
    "No jobs shared with you yet",
  ],
  "Job sẽ xuất hiện tại đây khi được chia sẻ cho tài khoản của bạn.": [
    "Job sẽ xuất hiện tại đây khi được chia sẻ cho tài khoản của bạn.",
    "Jobs will appear here when they are shared with your account.",
  ],
  "ATS Workspace": ["Không gian tuyển dụng ATS", "ATS Workspace"],
  "Không tải được danh sách quyền của Job.": [
    "Không tải được danh sách quyền của Job.",
    "Couldn’t load the team assigned to this job.",
  ],
  "Đã tạo Job nháp “{0}”.": [
    "Đã tạo Job nháp “{0}”.",
    "Draft job “{0}” created.",
  ],
  "Không tạo được Job nháp.": [
    "Không tạo được Job nháp.",
    "Couldn’t create the draft job.",
  ],
  "Mở Job “{0}” với mã {1}? Job sẽ chuyển sang trạng thái đang tuyển.": [
    "Mở Job “{0}” với mã {1}? Job sẽ chuyển sang trạng thái đang tuyển.",
    "Open “{0}” with reference {1}? This job will start accepting candidates.",
  ],
  "Đã mở tuyển Job “{0}” với mã {1}.": [
    "Đã mở tuyển Job “{0}” với mã {1}.",
    "“{0}” is open for hiring with reference {1}.",
  ],
  "Job “{0}” đã được mở với mã này trước đó.": [
    "Job “{0}” đã được mở với mã này trước đó.",
    "“{0}” is already open with this reference.",
  ],
  "Không mở được Job.": ["Không mở được Job.", "Couldn’t open this job."],
  "Đã lưu SLA Master và thông tin vị trí cho “{0}”.": [
    "Đã lưu SLA Master và thông tin vị trí cho “{0}”.",
    "Hiring targets and job details saved for “{0}”.",
  ],
  "Không lưu được thông tin SLA của Job.": [
    "Không lưu được thông tin SLA của Job.",
    "Couldn’t save this job’s hiring targets.",
  ],
  "Đã gán {0} cho {1}.": ["Đã gán {0} cho {1}.", "Assigned {0} to {1}."],
  "Người này đã có quyền tương ứng trên Job.": [
    "Người này đã có quyền tương ứng trên Job.",
    "This teammate already has that role on this job.",
  ],
  "Không gán được quyền.": [
    "Không gán được quyền.",
    "Couldn’t assign this role.",
  ],
  "Thu hồi quyền {0} của {1} trên Job này?": [
    "Thu hồi quyền {0} của {1} trên Job này?",
    "Remove {0} access for {1} on this job?",
  ],
  "Đã thu hồi quyền của {0} trên Job này.": [
    "Đã thu hồi quyền của {0} trên Job này.",
    "Removed {0}’s access to this job.",
  ],
  "Không thu hồi được quyền.": [
    "Không thu hồi được quyền.",
    "Couldn’t remove this role.",
  ],
  "Quản trị Job và quyền": ["Quản trị Job và quyền", "Manage jobs and access"],
  "Vị trí tuyển dụng": ["Vị trí tuyển dụng", "Job openings"],
  "Trong phạm vi quản lý": ["Trong phạm vi quản lý", "Within your access"],
  "Đang tuyển": ["Đang tuyển", "Hiring"],
  "Sẵn sàng nhận ứng viên": [
    "Sẵn sàng nhận ứng viên",
    "Ready to receive candidates",
  ],
  "Bản nháp": ["Bản nháp", "Draft"],
  "Cần hoàn thiện trước khi mở tuyển": [
    "Cần hoàn thiện trước khi mở tuyển",
    "Complete before opening for hiring",
  ],
  "Quản lý vị trí & đội ngũ": [
    "Quản lý vị trí & đội ngũ",
    "Manage jobs & your team",
  ],
  "Chọn việc bạn muốn thực hiện bên dưới.": [
    "Chọn việc bạn muốn thực hiện bên dưới.",
    "Choose what you would like to do below.",
  ],
  "Công cụ quản trị": ["Công cụ quản trị", "Admin tools"],
  "Tạo vị trí": ["Tạo vị trí", "Create a job"],
  "Mở tuyển": ["Mở tuyển", "Open for hiring"],
  "Yêu cầu tuyển dụng": ["Yêu cầu tuyển dụng", "Hiring requirements"],
  "Phân công đội ngũ": ["Phân công đội ngũ", "Assign your team"],
  "Tạo Job nháp": ["Tạo Job nháp", "Create draft job"],
  "Tạo vị trí ở trạng thái nháp. Mã Job được đặt khi mở tuyển.": [
    "Tạo vị trí ở trạng thái nháp. Mã Job được đặt khi mở tuyển.",
    "Start with a draft. Add the job reference when you open it for hiring.",
  ],
  "Tên vị trí": ["Tên vị trí", "Job title"],
  "Bộ phận": ["Bộ phận", "Department"],
  "Địa điểm": ["Địa điểm", "Location"],
  "Đang lưu…": ["Đang lưu…", "Saving…"],
  "Mở tuyển Job": ["Mở tuyển Job", "Open a job for hiring"],
  "Chọn Job nháp, kiểm tra lại tên và cấp mã Job trước khi xác nhận.": [
    "Chọn Job nháp, kiểm tra lại tên và cấp mã Job trước khi xác nhận.",
    "Choose a draft, check the title and add a job reference before confirming.",
  ],
  "Job nháp": ["Job nháp", "Draft job"],
  "Chọn Job nháp": ["Chọn Job nháp", "Choose a draft job"],
  "Chưa có địa điểm": ["Chưa có địa điểm", "No location set"],
  "Mã Job": ["Mã Job", "Job reference"],
  "Đang xử lý…": ["Đang xử lý…", "Working…"],
  "Xác nhận mở tuyển": ["Xác nhận mở tuyển", "Confirm opening"],
  "Thông tin SLA và yêu cầu": [
    "Thời hạn và yêu cầu tuyển dụng",
    "Hiring targets & requirements",
  ],
  "Chọn cấp độ, nhóm công việc và mùa tuyển dụng để xác định thời hạn tuyển dụng mục tiêu.":
    [
      "Chọn cấp độ, nhóm công việc và mùa tuyển dụng để xác định thời hạn tuyển dụng mục tiêu.",
      "Choose seniority, job function and hiring season to find the target time to hire.",
    ],
  Level: ["Cấp độ", "Seniority"],
  "Nhóm chức năng": ["Nhóm chức năng", "Job function"],
  "Tech/Product": ["Công nghệ / Sản phẩm", "Tech / Product"],
  "Non-Tech/Non-Product": ["Nhóm công việc khác", "Other functions"],
  "Mùa tuyển dụng": ["Mùa tuyển dụng", "Hiring season"],
  "Normal Time": ["Mùa thông thường", "Regular season"],
  "High Time": ["Mùa cao điểm", "Peak season"],
  "Ngày yêu cầu": ["Ngày yêu cầu", "Request date"],
  "Loại yêu cầu": ["Loại yêu cầu", "Request type"],
  "Ưu tiên": ["Ưu tiên", "Priority"],
  Critical: ["Khẩn cấp", "Urgent"],
  High: ["Cao", "High"],
  Normal: ["Bình thường", "Normal"],
  Low: ["Thấp", "Low"],
  "Thay thế vị trí": ["Thay thế vị trí", "Role being replaced"],
  "SLA tổng:": ["SLA tổng:", "Overall hiring target:"],
  "Tra theo Level × nhóm chức năng × mùa tuyển dụng.": [
    "Tra theo Level × nhóm chức năng × mùa tuyển dụng.",
    "Based on seniority, job function and hiring season.",
  ],
  "Lưu thông tin Job": ["Lưu thông tin Job", "Save job details"],
  "Gán quyền theo Job": ["Gán quyền theo Job", "Assign job access"],
  "Chọn vị trí, nhập email và phân công vai trò. Thành viên cần đăng nhập ATS ít nhất một lần trước khi được phân công.":
    [
      "Chọn vị trí, nhập email và phân công vai trò. Thành viên cần đăng nhập ATS ít nhất một lần trước khi được phân công.",
      "Choose a job, enter an email and assign a role. Teammates need to sign in to ATS at least once before you can assign them.",
    ],
  "Email người dùng": ["Email người dùng", "Teammate’s email"],
  "Vai trò trên Job": ["Vai trò trên Job", "Role on this job"],
  "TA / Recruiter": ["Chuyên viên tuyển dụng", "Recruiter"],
  "Hiring Manager": ["Quản lý tuyển dụng", "Hiring manager"],
  Interviewer: ["Người phỏng vấn", "Interviewer"],
  "Gán quyền": ["Gán quyền", "Assign role"],
  "Người đã được gán": ["Người đã được gán", "Assigned teammates"],
  "Đang tải…": ["Đang tải…", "Loading…"],
  "Thu hồi": ["Thu hồi", "Remove access"],
  "Chưa có người được gán trên Job này.": [
    "Chưa có người được gán trên Job này.",
    "No teammates assigned to this job yet.",
  ],
  "Bạn đang phân công quyền cho từng vị trí. Cần cấp quyền quản trị toàn hệ thống? Liên hệ người quản lý ATS.":
    [
      "Bạn đang phân công quyền cho từng vị trí. Cần cấp quyền quản trị toàn hệ thống? Liên hệ người quản lý ATS.",
      "These roles apply to individual jobs. Contact your ATS owner for workspace admin access.",
    ],
  "Mới ứng tuyển": ["Mới ứng tuyển", "New application"],
  "Từ chối": ["Từ chối", "Rejected"],
  "Không tải được dữ liệu. Vui lòng thử lại.": [
    "Không tải được dữ liệu. Vui lòng thử lại.",
    "Couldn’t load this data. Please try again.",
  ],
  "Không tải được dữ liệu Offer.": [
    "Không tải được dữ liệu Offer.",
    "Couldn’t load offers.",
  ],
  "Chuyển {0} {1} {2}?": ["Chuyển {0} {1} {2}?", "Move {0} {1} {2}?"],
  về: ["về", "back to"],
  "Bạn chỉ có quyền xem Pipeline của Job này.": [
    "Bạn chỉ có quyền xem Pipeline của Job này.",
    "You can view this job’s pipeline.",
  ],
  "Chọn một ứng viên để thao tác.": [
    "Chọn một ứng viên để thao tác.",
    "Choose a candidate to get started.",
  ],
  "Chỉ hồ sơ đang xử lý ở NEW, SCREEN hoặc INTERVIEW mới có thể chuyển vòng.": [
    "Chỉ hồ sơ đang xử lý ở Mới ứng tuyển, Sơ loại hoặc Phỏng vấn mới có thể chuyển vòng.",
    "Only active applications in New, Screening or Interview can move between these steps.",
  ],
  "Tổng quan Job đang chọn": [
    "Tổng quan Job đang chọn",
    "Selected job overview",
  ],
  "Tổng hồ sơ": ["Tổng hồ sơ", "Total applications"],
  "Đang xét tuyển": ["Đang xét tuyển", "Under review"],
  "Đang phỏng vấn": ["Đang phỏng vấn", "Interviewing"],
  "Tiến độ tuyển dụng": ["Tiến độ tuyển dụng", "Hiring progress"],
  "Chọn thẻ để xem hồ sơ. Khi chuyển vòng, ATS sẽ hỏi bạn xác nhận.": [
    "Chọn thẻ để xem hồ sơ. Khi chuyển vòng, ATS sẽ hỏi bạn xác nhận.",
    "Select a card to view the profile. ATS will ask you to confirm a stage change.",
  ],
  "Thêm ứng viên vào Job": ["Thêm ứng viên vào Job", "Add candidate to job"],
  "Tìm ứng viên trong Job": [
    "Tìm ứng viên trong Job",
    "Search candidates in this job",
  ],
  "Tìm ứng viên trong Job…": [
    "Tìm ứng viên trong Job…",
    "Search candidates in this job…",
  ],
  Nguồn: ["Nguồn", "Source"],
  "Lọc nguồn ứng viên": ["Lọc nguồn ứng viên", "Filter candidates by source"],
  "Tất cả nguồn": ["Tất cả nguồn", "All sources"],
  "hồ sơ đang hiển thị": ["hồ sơ đang hiển thị", "applications shown"],
  "Ngày ứng tuyển": ["Ngày ứng tuyển", "Application date"],
  "Danh sách ứng viên được chia trang; bộ lọc nguồn áp dụng cho trang đang xem. Số liệu tổng quan tính trên toàn bộ Job. Mục tiêu thời gian từng vòng chỉ để tham khảo.":
    [
      "Danh sách ứng viên được chia trang; bộ lọc nguồn áp dụng cho trang đang xem. Số liệu tổng quan tính trên toàn bộ Job. Mục tiêu thời gian từng vòng chỉ để tham khảo.",
      "Candidates are shown in pages; source filters apply to the current page. Overview totals cover the full job. Stage time targets are for reference.",
    ],
  "Chế độ chỉ xem. Chỉ Admin hoặc TA được phân công vào Job này mới có thể chuyển ứng viên giữa các vòng.":
    [
      "Chế độ chỉ xem. Chỉ Admin hoặc TA được phân công vào Job này mới có thể chuyển ứng viên giữa các vòng.",
      "View only. Only an admin or a recruiter assigned to this job can move candidates between stages.",
    ],
  "Đang tải ứng viên…": ["Đang tải ứng viên…", "Loading candidates…"],
  "Không có quyền. Dữ liệu của Job này đã được xoá khỏi màn hình.": [
    "Không có quyền. Dữ liệu của Job này đã được xoá khỏi màn hình.",
    "Access unavailable. This job’s data has been removed from the screen.",
  ],
  "Thử lại": ["Thử lại", "Try again"],
  "Không tải được dữ liệu Offer:": [
    "Không tải được dữ liệu Offer:",
    "Couldn’t load offers:",
  ],
  "Chưa có ứng viên": ["Chưa có ứng viên", "No candidates yet"],
  "Không có kết quả trong phạm vi Job này.": [
    "Không có kết quả trong phạm vi Job này.",
    "No results within this job.",
  ],
  "Thử lại chuyển": ["Thử lại chuyển", "Retry move to"],
  "Giai đoạn {0}": ["Giai đoạn {0}", "Stage {0}"],
  "Mục tiêu: ≤": ["Mục tiêu: ≤", "Target: ≤"],
  ngày: ["ngày", "days"],
  "Tiếp nhận và liên hệ ứng viên.": [
    "Tiếp nhận và liên hệ ứng viên.",
    "Receive applications and contact candidates.",
  ],
  "Đánh giá hồ sơ và trao đổi ban đầu.": [
    "Đánh giá hồ sơ và trao đổi ban đầu.",
    "Review profiles and have an initial conversation.",
  ],
  "Theo dõi các vòng phỏng vấn.": [
    "Theo dõi các vòng phỏng vấn.",
    "Track interview rounds.",
  ],
  "Theo dõi đề nghị đang chờ hoặc đã được duyệt.": [
    "Theo dõi đề nghị đang chờ hoặc đã được duyệt.",
    "Track pending or approved offers.",
  ],
  "Chưa có ứng viên ở vòng này.": [
    "Chưa có ứng viên ở vòng này.",
    "No candidates at this stage yet.",
  ],
  "Kéo sang {0}": ["Kéo sang {0}", "Drag to {0}"],
  " hoặc ": [" hoặc ", " or "],
  "Mở hồ sơ của {0}. {1}": ["Mở hồ sơ của {0}. {1}", "Open {0}’s profile. {1}"],
  "Chưa ghi nguồn": ["Chưa ghi nguồn", "Source not recorded"],
  "Offer đã duyệt": ["Offer đã duyệt", "Offer approved"],
  "Offer chờ duyệt": ["Offer chờ duyệt", "Offer awaiting approval"],
  "Đang xử lý": ["Đang xử lý", "In progress"],
  "BƯỚC HIỆN TẠI": ["BƯỚC HIỆN TẠI", "CURRENT STEP"],
  "Xem hồ sơ →": ["Xem hồ sơ →", "View profile →"],
  "Đang ở trang đầu": ["Đang ở trang đầu", "You’re on the first page"],
  "Trang trước": ["Trang trước", "Previous page"],
  Trang: ["Trang", "Page"],
  "Không còn trang sau": ["Không còn trang sau", "No more pages"],
  "Trang sau": ["Trang sau", "Next page"],
  "Chi tiết ứng viên": ["Chi tiết ứng viên", "Candidate details"],
  "Đóng chi tiết": ["Đóng chi tiết", "Close details"],
  Đóng: ["Đóng", "Close"],
  "Đang tải chi tiết…": ["Đang tải chi tiết…", "Loading details…"],
  "Ứng viên": ["Ứng viên", "Candidate"],
  "Giai đoạn": ["Giai đoạn", "Stage"],
  "Trạng thái": ["Trạng thái", "Status"],
  "Không có": ["Không có", "None recorded"],
  "Lịch sử": ["Lịch sử", "History"],
  "Người dùng": ["Người dùng", "Team member"],
  "Matching context": ["Thông tin đối chiếu", "Matching details"],
  "Thử lại chuyển về {0}": ["Thử lại chuyển về {0}", "Retry move back to {0}"],
  "Chuyển về {0}": ["Chuyển về {0}", "Move back to {0}"],
  "Thử lại chuyển {0}": ["Thử lại chuyển {0}", "Retry move to {0}"],
  "Thử lại chuyển sang {0}": ["Thử lại chuyển sang {0}", "Retry move to {0}"],
  "Chuyển sang {0}": ["Chuyển sang {0}", "Move to {0}"],
  "Không tải được danh mục nguồn tuyển dụng.": [
    "Không tải được danh mục nguồn tuyển dụng.",
    "Couldn’t load recruitment sources.",
  ],
  "Không tải được Talent Pool.": [
    "Không tải được Talent Pool.",
    "Couldn’t load the candidate pool.",
  ],
  "Không tải được hồ sơ ứng viên.": [
    "Không tải được hồ sơ ứng viên.",
    "Couldn’t load this candidate’s profile.",
  ],
  "Thêm {0} vào {1}? Ứng viên sẽ được đưa vào vòng Mới ứng tuyển.": [
    "Thêm {0} vào {1}? Ứng viên sẽ được đưa vào vòng Mới ứng tuyển.",
    "Add {0} to {1}? The candidate will enter New application.",
  ],
  "Đã thêm vào Job “{0}”. Ứng viên xuất hiện ở vòng Mới ứng tuyển.": [
    "Đã thêm vào Job “{0}”. Ứng viên xuất hiện ở vòng Mới ứng tuyển.",
    "Added to “{0}”. The candidate is now at New application.",
  ],
  "Không thêm được ứng viên vào Job.": [
    "Không thêm được ứng viên vào Job.",
    "Couldn’t add this candidate to the job.",
  ],
  "CV cần duyệt": ["CV cần duyệt", "CVs to review"],
  "Duyệt CV trước; CV được chấp thuận sẽ trở thành hồ sơ trong Talent Pool.": [
    "Duyệt CV trước; CV được chấp thuận sẽ trở thành hồ sơ trong Talent Pool.",
    "Review CVs first. Approved CVs become profiles in your candidate pool.",
  ],
  "Quay lại Talent Pool": ["Quay lại Talent Pool", "Back to candidate pool"],
  "Kho ứng viên": ["Kho ứng viên", "Candidate pool"],
  "CV được duyệt sẽ xuất hiện ở đây. Chọn hồ sơ để xem CV và thêm ứng viên vào Job đang mở.":
    [
      "CV được duyệt sẽ xuất hiện ở đây. Chọn hồ sơ để xem CV và thêm ứng viên vào Job đang mở.",
      "Approved CVs appear here. Choose a profile to view the CV and add the candidate to an open job.",
    ],
  "CV chờ duyệt": ["CV chờ duyệt", "CVs waiting for review"],
  "Tìm trong Talent Pool": ["Tìm trong Talent Pool", "Search candidate pool"],
  "Tìm tên, kỹ năng, công ty…": [
    "Tìm tên, kỹ năng, công ty…",
    "Search names, skills, companies…",
  ],
  "Đang tải hồ sơ…": ["Đang tải hồ sơ…", "Loading profiles…"],
  "{0} hồ sơ trên trang": ["{0} hồ sơ trên trang", "{0} profiles on this page"],
  "Chưa có chức danh": ["Chưa có chức danh", "No current title recorded"],
  "Chưa có thông tin công ty / địa điểm": [
    "Chưa có thông tin công ty / địa điểm",
    "No company or location recorded",
  ],
  "Talent Pool chưa có hồ sơ": [
    "Talent Pool chưa có hồ sơ",
    "No candidate profiles yet",
  ],
  "Thêm CV vào hàng chờ duyệt. Sau khi Admin/TA chấp thuận, ứng viên sẽ được đưa vào kho.":
    [
      "Thêm CV vào hàng chờ duyệt. Sau khi Admin/TA chấp thuận, ứng viên sẽ được đưa vào kho.",
      "Add CVs to the review queue. Once approved by an admin or recruiter, they will appear here.",
    ],
  "Mở CV chờ duyệt": ["Mở CV chờ duyệt", "Open CV review queue"],
  "Đang mở hồ sơ…": ["Đang mở hồ sơ…", "Opening profile…"],
  "Vị trí hiện tại": ["Vị trí hiện tại", "Current role"],
  "Vòng phỏng vấn": ["Vòng phỏng vấn", "Interview round"],
  "Matching": ["Matching", "Matching"],
  Email: ["Email", "Email"],
  "Điện thoại": ["Điện thoại", "Phone"],
  "Công ty hiện tại": ["Công ty hiện tại", "Current company"],
  "Kinh nghiệm": ["Kinh nghiệm", "Experience"],
  "{0} năm": ["{0} năm", "{0} years"],
  "Cấp bậc": ["Cấp bậc", "Seniority"],
  "CV / tài liệu": ["CV / tài liệu", "CVs / documents"],
  "Mở CV ↗": ["Mở CV ↗", "Open CV ↗"],
  "Link không hợp lệ": ["Link không hợp lệ", "Invalid link"],
  "Chưa có CV được lưu trong hồ sơ.": [
    "Chưa có CV được lưu trong hồ sơ.",
    "No CV saved on this profile yet.",
  ],
  "Đang tham gia Job": ["Đang tham gia Job", "Job applications"],
  "Chưa được thêm vào Job nào trong phạm vi bạn được xem.": [
    "Chưa được thêm vào Job nào trong phạm vi bạn được xem.",
    "No applications within the jobs you can access.",
  ],
  "Thêm vào Job": ["Thêm vào Job", "Add to job"],
  "Chọn Job để thêm ứng viên": [
    "Chọn Job để thêm ứng viên",
    "Choose a job for this candidate",
  ],
  "Chọn Job đang mở": ["Chọn Job đang mở", "Choose an open job"],
  "Chọn nguồn ứng viên": ["Chọn nguồn ứng viên", "Choose a candidate source"],
  "Đang thêm…": ["Đang thêm…", "Adding…"],
  "Không có Job đang mở mà bạn có quyền thêm hồ sơ này.": [
    "Không có Job đang mở mà bạn có quyền thêm hồ sơ này.",
    "No open jobs available for you to add this profile.",
  ],
  "Chọn một hồ sơ": ["Chọn một hồ sơ", "Choose a profile"],
  "Thông tin chi tiết và các Job liên quan sẽ hiển thị tại đây.": [
    "Thông tin chi tiết và các Job liên quan sẽ hiển thị tại đây.",
    "Candidate details and related jobs will appear here.",
  ],
  "Không tải được danh mục nguồn. Hãy tải lại trang hoặc báo Admin.": [
    "Không tải được danh mục nguồn. Hãy tải lại trang hoặc báo Admin.",
    "Couldn’t load sources. Reload the page or contact your admin.",
  ],
  "Chỉ Job đang mở tuyển mới có thể nhận ứng viên.": [
    "Chỉ Job đang mở tuyển mới có thể nhận ứng viên.",
    "Only jobs open for hiring can receive candidates.",
  ],
  "Nhập họ tên, email hoặc số điện thoại, link CV Drive, tên tệp và nguồn ứng viên.":
    [
      "Nhập họ tên, email hoặc số điện thoại, link CV Drive, tên tệp và nguồn ứng viên.",
      "Enter a name, email or phone, Drive CV link, file name and source.",
    ],
  "Thêm ứng viên vào vòng NEW của Job {0}? CV chỉ được lưu dưới dạng liên kết Drive, không gửi sang AI.":
    [
      "Thêm ứng viên vào vòng NEW của Job {0}? CV chỉ được lưu dưới dạng liên kết Drive, không gửi sang AI.",
      "Add a candidate to New application for {0}? Only the Drive link is saved; the CV will not be sent to AI.",
    ],
  "Thêm ứng viên thủ công": [
    "Thêm ứng viên thủ công",
    "Add a candidate manually",
  ],
  "Chỉ lưu liên kết CV trên Google Drive. ATS không tải CV lên và không gửi CV sang AI ở luồng này.":
    [
      "Chỉ lưu liên kết CV trên Google Drive. ATS không tải CV lên và không gửi CV sang AI ở luồng này.",
      "Save a Google Drive CV link. This flow does not upload the CV or send it to AI.",
    ],
  "Đã thêm ứng viên vào Job ở vòng NEW.": [
    "Đã thêm ứng viên vào Job ở vòng NEW.",
    "Candidate added to New application.",
  ],
  "Thử lại với cùng request_id": ["Thử thêm lại", "Try adding again"],
  "Họ và tên *": ["Họ và tên *", "Full name *"],
  "Họ và tên ứng viên": ["Họ và tên ứng viên", "Candidate’s full name"],
  "Email ứng viên": ["Email ứng viên", "Candidate’s email"],
  "Số điện thoại": ["Số điện thoại", "Phone number"],
  "Số điện thoại ứng viên": [
    "Số điện thoại ứng viên",
    "Candidate’s phone number",
  ],
  "Chức danh hiện tại": ["Chức danh hiện tại", "Current job title"],
  "Nguồn ứng viên *": ["Nguồn ứng viên *", "Candidate source *"],
  "Nguồn ứng viên": ["Nguồn ứng viên", "Candidate source"],
  "Chọn nguồn": ["Chọn nguồn", "Choose a source"],
  "Link CV trên Drive *": ["Link CV trên Drive *", "Drive CV link *"],
  "Tên tệp CV *": ["Tên tệp CV *", "CV file name *"],
  "Tên tệp CV": ["Tên tệp CV", "CV file name"],
  "Email hoặc số điện thoại là bắt buộc để chống tạo trùng.": [
    "Email hoặc số điện thoại là bắt buộc để chống tạo trùng.",
    "An email or phone number is required to help prevent duplicates.",
  ],
  "Thêm ứng viên vào pipeline": [
    "Thêm ứng viên vào pipeline",
    "Add candidate to pipeline",
  ],
  "Đang tạo…": ["Đang tạo…", "Creating…"],
  "Thử lại thêm ứng viên": [
    "Thử lại thêm ứng viên",
    "Try adding candidate again",
  ],
  "Thêm vào pipeline": ["Thêm vào pipeline", "Add to pipeline"],
  SCREEN: ["Sơ loại", "Screening"],
  INTERVIEW: ["Phỏng vấn", "Interview"],
  HIRED: ["Đã tuyển", "Hired"],
  REJECTED: ["Từ chối", "Rejected"],
  ACTIVE: ["Đang xử lý", "In progress"],
  CLOSED: ["Đã kết thúc", "Closed"],
  OFFER: ["Đề nghị nhận việc", "Offer"],
  Offer: ["Đề nghị nhận việc", "Offer"],
  OPEN: ["Đang tuyển", "Hiring"],
  DRAFT: ["Bản nháp", "Draft"],
  ON_HOLD: ["Tạm dừng", "On hold"],
  CRITICAL: ["Khẩn cấp", "Urgent"],
  HIGH: ["Cao", "High"],
  NORMAL: ["Bình thường", "Normal"],
  LOW: ["Thấp", "Low"],
  SCREENED: ["Đã sơ loại", "Screened"],
  STAGE_CHANGED: ["Đã chuyển vòng", "Stage changed"],
  CREATED: ["Đã tạo hồ sơ", "Application created"],
};

export function uiText(
  locale: Locale,
  key: string,
  values: readonly unknown[] = [],
): string {
  const pair = uiCopy[key];
  const template = pair ? pair[locale === "en" ? 1 : 0] : key;
  return template.replace(/\{(\d+)\}/g, (token, index: string) =>
    String(values[Number(index)] ?? token),
  );
}

// Stored success/error notices can outlive a language switch. Only match known
// interface templates; never translate arbitrary profile or document content.
const noticeTemplates = Object.values(uiCopy)
  .filter(
    (pair) =>
      !pair[0].includes("{0}") ||
      /^(Đã|Không|Chưa|Người này|Job “)/.test(pair[0]),
  )
  .flatMap((pair) =>
    pair.map((template, language) => {
      const parts = template.split(/(\{\d+\})/g);
      const indexes: number[] = [];
      const pattern = parts
        .map((part) => {
          const match = /^\{(\d+)\}$/.exec(part);
          if (match) {
            indexes.push(Number(match[1]));
            return "([\\s\\S]*?)";
          }
          return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        })
        .join("");
      return {
        expression: new RegExp(`^${pattern}$`),
        indexes,
        pair,
        language,
      };
    }),
  );
export function uiNotice(locale: Locale, text: string): string {
  for (const item of noticeTemplates) {
    const match = item.expression.exec(text);
    if (!match) continue;
    const values: string[] = [];
    item.indexes.forEach((index, position) => {
      values[index] = match[position + 1];
    });
    return item.pair[locale === "en" ? 1 : 0].replace(
      /\{(\d+)\}/g,
      (_, index: string) => values[Number(index)] ?? "",
    );
  }
  return text;
}

export function uiError(locale: Locale, text: string): string {
  const localized = uiNotice(locale, text);
  if (
    localized !== text ||
    Object.values(uiCopy).some((pair) => pair.includes(text))
  )
    return localized;
  return friendlyError(text, getCopy(locale));
}
export function eventLabel(locale: Locale, code: string): string {
  return uiText(locale, Object.hasOwn(uiCopy, code) ? code : "Cập nhật hồ sơ");
}
