import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import ApplicationPipeline from "../components/application-pipeline";
import { ApiError } from "../lib/supabase";

const api = vi.hoisted(() => ({
  list: vi.fn(),
  search: vi.fn(),
  detail: vi.fn(),
  screen: vi.fn(),
  interview: vi.fn(),
  back: vi.fn(),
}));
const confirmMock = vi.hoisted(() => vi.fn());
const randomUuidMock = vi.hoisted(() => vi.fn());
vi.mock("../lib/applications", () => ({
  listApplications: api.list,
  searchApplications: api.search,
  applicationDetail: api.detail,
  screenApplication: api.screen,
  interviewApplication: api.interview,
  moveApplicationBack: api.back,
}));
vi.mock("../lib/supabase", () => ({
  ApiError: class ApiError extends Error {
    constructor(
      message: string,
      public status?: number,
    ) {
      super(message);
    }
  },
  getClient: () => ({
    from: () => {
      const result = {
        data: [
          {
            sub_source: "TEST ONLY",
            source: "TEST ONLY",
            source_ownership: "TEST ONLY",
          },
        ],
        error: null,
      };
      const query = {
        select: () => query,
        order: () => query,
        then: (resolve: (value: typeof result) => unknown) =>
          Promise.resolve(result).then(resolve),
      };
      return query;
    },
  }),
}));

const job = {
  id: "job-1",
  job_code: "TEST-1",
  title: "Test only job",
  status: "OPEN",
};
const application = (id: string, stage = "NEW") => ({
  application_id: id,
  candidate_id: `candidate-${id}`,
  candidate_name: id,
  stage,
  status: "ACTIVE",
  source: "TEST ONLY",
  created_at: "2026-01-01T00:00:00Z",
});
const detail = (id: string, stage = "NEW") => ({
  application: application(id, stage),
  events: [],
  event_count: 0,
  limit: 50,
  offset: 0,
});
async function renderPipeline(canManageApplications = true, switchToBoard = true) {
  const result = render(
    <ApplicationPipeline
      job={job}
      onSessionLost={vi.fn()}
      canManageApplications={canManageApplications}
    />,
  );
  // These tests cover the Kanban interactions; the redesigned default is the table.
  if (switchToBoard) {
    fireEvent.click(await screen.findByRole("button", { name: "Kanban" }));
  }
  return result;
}

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  confirmMock.mockReset();
  confirmMock.mockReturnValue(true);
  randomUuidMock.mockReset();
  randomUuidMock.mockReturnValue("11111111-1111-4111-8111-111111111111");
  vi.stubGlobal("confirm", confirmMock);
  vi.stubGlobal("crypto", { randomUUID: randomUuidMock });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("application pipeline", () => {
  it("shows explicit forbidden state rather than an empty list", async () => {
    api.list.mockRejectedValue(new ApiError("Không có quyền", 403));
    await renderPipeline(true, false);
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Không có quyền",
    );
    expect(screen.queryByText("Chưa có ứng viên")).toBeNull();
  });
  it("keeps the board visible when the Job has no Applications", async () => {
    api.list.mockResolvedValue({ applications: [], limit: 25, offset: 0 });
    await renderPipeline();
    await screen.findByText("Chưa có ứng viên");
    expect(
      screen.getByRole("region", { name: "Giai đoạn Mới ứng tuyển" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("region", { name: "Giai đoạn Sơ loại" }),
    ).toBeTruthy();
  });

  it("shows empty pipeline columns even when the API returns only NEW", async () => {
    api.list.mockResolvedValue({
      applications: [application("Ada")],
      limit: 25,
      offset: 0,
    });
    await renderPipeline();
    await screen.findByRole("region", { name: "Giai đoạn Mới ứng tuyển" });
    expect(
      screen.getByRole("region", { name: "Giai đoạn Sơ loại" }).textContent,
    ).toContain("Chưa có ứng viên");
    expect(
      screen.getByRole("region", { name: "Giai đoạn Phỏng vấn" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("region", { name: "Giai đoạn Đã tuyển" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("region", { name: "Giai đoạn Từ chối" }),
    ).toBeTruthy();
  });

  it("keeps an unassigned viewer read-only", async () => {
    api.list.mockResolvedValue({
      applications: [application("Ada", "SCREEN")],
      limit: 25,
      offset: 0,
    });
    api.detail.mockResolvedValue(detail("Ada", "SCREEN"));
    await renderPipeline(false);
    const card = await screen.findByRole("button", { name: /Ada/ });
    expect(screen.getByRole("status").textContent).toContain("Chế độ chỉ xem");
    expect(card.getAttribute("draggable")).toBe("false");
    fireEvent.click(card);
    await screen.findByRole("heading", { name: "Lịch sử" });
    expect(
      screen.queryByRole("button", { name: /Chuyển (về|sang)/ }),
    ).toBeNull();
  });

  it("moves NEW to SCREEN when dropped on the empty SCREEN column", async () => {
    api.list
      .mockResolvedValueOnce({
        applications: [application("Ada")],
        limit: 25,
        offset: 0,
      })
      .mockResolvedValueOnce({
        applications: [application("Ada", "SCREEN")],
        limit: 25,
        offset: 0,
      });
    api.screen.mockResolvedValue({
      application: { application_id: "Ada", changed: true },
    });
    await renderPipeline();
    const card = await screen.findByRole("button", { name: /Ada/ });
    const target = screen.getByRole("region", { name: "Giai đoạn Sơ loại" });
    fireEvent.dragStart(card);
    fireEvent.dragOver(target);
    fireEvent.drop(target);
    await waitFor(() =>
      expect(api.screen).toHaveBeenCalledWith(
        "Ada",
        "11111111-1111-4111-8111-111111111111",
      ),
    );
    expect(confirmMock).toHaveBeenCalledWith("Chuyển Ada sang Sơ loại?");
  });

  it("moves INTERVIEW back to SCREEN when dropped on the previous column", async () => {
    api.list.mockResolvedValue({
      applications: [application("Ada", "INTERVIEW")],
      limit: 25,
      offset: 0,
    });
    api.back.mockResolvedValue({
      application: { application_id: "Ada", changed: true },
    });
    await renderPipeline();
    const card = await screen.findByRole("button", { name: /Ada/ });
    const target = screen.getByRole("region", { name: "Giai đoạn Sơ loại" });
    fireEvent.dragStart(card);
    fireEvent.dragOver(target);
    fireEvent.drop(target);
    await waitFor(() =>
      expect(api.back).toHaveBeenCalledWith(
        "Ada",
        "SCREEN",
        "11111111-1111-4111-8111-111111111111",
      ),
    );
    expect(confirmMock).toHaveBeenCalledWith("Chuyển Ada về Sơ loại?");
  });

  it("moves SCREEN back to NEW when dropped on the first column", async () => {
    api.list.mockResolvedValue({
      applications: [application("Ada", "SCREEN")],
      limit: 25,
      offset: 0,
    });
    api.back.mockResolvedValue({
      application: { application_id: "Ada", changed: true },
    });
    await renderPipeline();
    const card = await screen.findByRole("button", { name: /Ada/ });
    const target = screen.getByRole("region", {
      name: "Giai đoạn Mới ứng tuyển",
    });
    fireEvent.dragStart(card);
    fireEvent.dragOver(target);
    fireEvent.drop(target);
    await waitFor(() =>
      expect(api.back).toHaveBeenCalledWith(
        "Ada",
        "NEW",
        "11111111-1111-4111-8111-111111111111",
      ),
    );
    expect(confirmMock).toHaveBeenCalledWith("Chuyển Ada về Mới ứng tuyển?");
  });

  it("clears Application data and retry state when transition access is revoked", async () => {
    api.list.mockResolvedValue({
      applications: [application("Ada")],
      limit: 25,
      offset: 0,
    });
    api.detail.mockResolvedValue(detail("Ada"));
    api.screen.mockRejectedValue(new ApiError("Không có quyền", 403));
    await renderPipeline();

    fireEvent.click(await screen.findByRole("button", { name: /Ada/ }));
    await screen.findByText("Lịch sử");
    fireEvent.click(
      screen.getByRole("button", { name: "Chuyển sang Sơ loại" }),
    );

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Không có quyền",
    );
    expect(screen.queryByLabelText("Chi tiết Application")).toBeNull();
    expect(screen.queryByRole("button", { name: /Ada/ })).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Thử lại chuyển (sang )?Sơ loại/ }),
    ).toBeNull();
  });

  it("moves SCREEN to INTERVIEW through the guarded backend action", async () => {
    api.list
      .mockResolvedValueOnce({
        applications: [application("Ada", "SCREEN")],
        limit: 25,
        offset: 0,
      })
      .mockResolvedValueOnce({
        applications: [application("Ada", "INTERVIEW")],
        limit: 25,
        offset: 0,
      });
    api.interview.mockResolvedValue({
      application: { application_id: "Ada", changed: true },
    });
    await renderPipeline();
    const card = await screen.findByRole("button", { name: /Ada/ });
    const target = screen.getByRole("region", { name: "Giai đoạn Phỏng vấn" });
    fireEvent.dragStart(card);
    fireEvent.dragOver(target);
    fireEvent.drop(target);
    await waitFor(() =>
      expect(api.interview).toHaveBeenCalledWith(
        "Ada",
        "11111111-1111-4111-8111-111111111111",
      ),
    );
    expect(confirmMock).toHaveBeenCalledWith("Chuyển Ada sang Phỏng vấn?");
  });
  it("does not let an old detail response replace the latest selection", async () => {
    let resolveOld!: (value: ReturnType<typeof detail>) => void;
    api.list.mockResolvedValue({
      applications: [application("Old"), application("New")],
      limit: 25,
      offset: 0,
    });
    api.detail.mockImplementation((_job: string, id: string) =>
      id === "Old"
        ? new Promise((resolve) => {
            resolveOld = resolve;
          })
        : Promise.resolve(detail("New")),
    );
    await renderPipeline();
    fireEvent.click(await screen.findByRole("button", { name: /Mở hồ sơ của Old/ }));
    fireEvent.click(screen.getByRole("button", { name: /Mở hồ sơ của New/ }));
    await waitFor(() =>
      expect(screen.getByLabelText("Chi tiết ứng viên").textContent).toContain(
        "New",
      ),
    );
    await act(async () => resolveOld(detail("Old")));
    expect(
      screen.getByRole("button", { name: /Mở hồ sơ của Old/ }),
    ).toBeTruthy(); // Old remains a card, but not detail content.
    expect(screen.getByLabelText("Chi tiết ứng viên").textContent).toContain(
      "New",
    );
    expect(
      screen.getByLabelText("Chi tiết ứng viên").textContent,
    ).not.toContain("Old");
  });
  it("closes the previous detail when a new search has no results", async () => {
    api.list.mockResolvedValue({
      applications: [application("Ada")],
      limit: 25,
      offset: 0,
    });
    api.detail.mockResolvedValue(detail("Ada"));
    api.search.mockResolvedValue({ applications: [], limit: 25, offset: 0 });
    await renderPipeline();
    fireEvent.click(await screen.findByRole("button", { name: /Ada/ }));
    await screen.findByText("Lịch sử");

    fireEvent.change(
      screen.getByRole("textbox", { name: "Tìm ứng viên trong Job" }),
      {
        target: { value: "No matching candidate" },
      },
    );

    expect(await screen.findByText("Chưa có ứng viên")).toBeTruthy();
    await waitFor(() =>
      expect(screen.queryByLabelText("Chi tiết ứng viên")).toBeNull(),
    );
  });
  it("renders actor display name and hides null matching context", async () => {
    api.list.mockResolvedValue({
      applications: [application("Ada")],
      limit: 25,
      offset: 0,
    });
    api.detail.mockResolvedValue({
      ...detail("Ada"),
      events: [
        {
          event_id: "event-1",
          actor_id: "actor-1",
          actor_display_name: "TEST ONLY Recruiter",
          event_type: "MOVED",
          from_stage: "NEW",
          to_stage: "SCREEN",
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
      matching_context: null,
    });
    await renderPipeline();
    fireEvent.click(await screen.findByRole("button", { name: /Ada/ }));
    expect(
      (await screen.findByLabelText("Chi tiết ứng viên")).textContent,
    ).toContain("TEST ONLY Recruiter");
    expect(screen.queryByText("Matching context")).toBeNull();
  });
  it("retries screen with the same generated request id", async () => {
    api.list.mockResolvedValue({
      applications: [application("Ada")],
      limit: 25,
      offset: 0,
    });
    api.detail.mockResolvedValue(detail("Ada"));
    api.screen
      .mockRejectedValueOnce(new Error("Mạng lỗi"))
      .mockResolvedValue({ application: application("Ada") });
    await renderPipeline();
    fireEvent.click(await screen.findByRole("button", { name: /Ada/ }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Chuyển sang Sơ loại" }),
    );
    await screen.findByText(
      "Chưa thực hiện được thao tác này. Bạn thử lại nhé. Nếu vẫn gặp lỗi, hãy liên hệ quản trị viên.",
    );
    fireEvent.click(
      screen.getAllByRole("button", {
        name: /Thử lại chuyển (sang )?Sơ loại/,
      })[0],
    );
    await waitFor(() => expect(api.screen).toHaveBeenCalledTimes(2));
    expect(api.screen.mock.calls[0][1]).toBe(api.screen.mock.calls[1][1]);
    expect(randomUuidMock).toHaveBeenCalledTimes(1);
    expect(confirmMock).toHaveBeenCalledTimes(1);
  });
});

describe("Kanban drag and drop", () => {
  it("shows an empty SCREEN column for a Job with no applications", async () => {
    api.list.mockResolvedValue({ applications: [], limit: 25, offset: 0 });
    await renderPipeline();
    await screen.findByText("Chưa có ứng viên");
    expect(
      screen.getByRole("region", { name: "Giai đoạn Sơ loại" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("region", { name: "Giai đoạn Mới ứng tuyển" }),
    ).toBeTruthy();
  });

  it("moves the first NEW application into an empty SCREEN column", async () => {
    const moved = { ...application("Ada"), stage: "SCREEN" };
    api.list
      .mockResolvedValueOnce({
        applications: [application("Ada")],
        limit: 25,
        offset: 0,
      })
      .mockResolvedValue({ applications: [moved], limit: 25, offset: 0 });
    api.screen.mockResolvedValue({
      application: { application_id: "Ada", changed: true },
    });
    await renderPipeline();
    const card = await screen.findByRole("button", {
      name: /Mở hồ sơ của Ada/,
    });
    expect(card.getAttribute("draggable")).toBe("true");
    fireEvent.dragStart(card);
    const target = screen.getByRole("region", { name: "Giai đoạn Sơ loại" });
    fireEvent.dragOver(target);
    fireEvent.drop(target);
    await waitFor(() =>
      expect(api.screen).toHaveBeenCalledWith(
        "Ada",
        "11111111-1111-4111-8111-111111111111",
      ),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("region", { name: "Giai đoạn Mới ứng tuyển" })
          .textContent,
      ).not.toContain("Ada"),
    );
    expect(
      screen.getByRole("region", { name: "Giai đoạn Sơ loại" }).textContent,
    ).toContain("Ada");
    expect(confirmMock).toHaveBeenCalledTimes(1);
  });
  it("does not submit a cancelled drop or drag an inactive application", async () => {
    api.list.mockResolvedValue({
      applications: [
        application("Ada"),
        { ...application("Inactive"), status: "REJECTED" },
      ],
      limit: 25,
      offset: 0,
    });
    confirmMock.mockReturnValue(false);
    await renderPipeline();
    const card = await screen.findByRole("button", {
      name: /Mở hồ sơ của Ada/,
    });
    const inactive = screen.getByRole("button", {
      name: /Mở hồ sơ của Inactive/,
    });
    expect(inactive.getAttribute("draggable")).toBe("false");
    fireEvent.dragStart(card);
    fireEvent.drop(screen.getByRole("region", { name: "Giai đoạn Sơ loại" }));
    expect(api.screen).not.toHaveBeenCalled();
    fireEvent.dragStart(inactive);
    fireEvent.drop(screen.getByRole("region", { name: "Giai đoạn Sơ loại" }));
    expect(api.screen).not.toHaveBeenCalled();
  });
});

describe("Kanban failure feedback", () => {
  it.each([new Error("Network failed"), new ApiError("Stage conflict", 409)])(
    "shows a failed unselected drop and retries the same Application and request ID (%s)",
    async (failure) => {
      api.list.mockResolvedValue({
        applications: [application("Ada")],
        limit: 25,
        offset: 0,
      });
      api.screen.mockRejectedValueOnce(failure).mockResolvedValueOnce({
        application: { application_id: "Ada", changed: true },
      });
      await renderPipeline();
      fireEvent.click(screen.getByRole("button", { name: "Đóng chi tiết" }));
      const card = await screen.findByRole("button", {
        name: /Mở hồ sơ của Ada/,
      });
      fireEvent.dragStart(card);
      fireEvent.drop(screen.getByRole("region", { name: "Giai đoạn Sơ loại" }));
      const retry = await screen.findByRole("button", {
        name: /Thử lại chuyển (sang )?Sơ loại/,
      });
      const alert = retry.closest('[role="alert"]')!;
      expect(alert.textContent).toContain("Chưa thực hiện được thao tác này");
      expect(alert.textContent).toContain("Ada");
      expect(screen.queryByLabelText("Chi tiết ứng viên")).toBeNull();
      fireEvent.click(
        screen.getAllByRole("button", {
          name: /Thử lại chuyển (sang )?Sơ loại/,
        })[0],
      );
      await waitFor(() => expect(api.screen).toHaveBeenCalledTimes(2));
      expect(api.screen.mock.calls[1]).toEqual(api.screen.mock.calls[0]);
      expect(confirmMock).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    },
  );
  it("retries the dragged card even when another Application is open", async () => {
    api.list.mockResolvedValue({
      applications: [application("Ada"), application("Other")],
      limit: 25,
      offset: 0,
    });
    api.detail.mockResolvedValue(detail("Other"));
    api.screen
      .mockRejectedValueOnce(new Error("Network failed"))
      .mockResolvedValueOnce({
        application: { application_id: "Ada", changed: true },
      });
    await renderPipeline();
    fireEvent.click(
      await screen.findByRole("button", { name: /Mở hồ sơ của Other/ }),
    );
    await screen.findByText("Lịch sử");
    fireEvent.dragStart(
      screen.getByRole("button", { name: /Mở hồ sơ của Ada/ }),
    );
    fireEvent.drop(screen.getByRole("region", { name: "Giai đoạn Sơ loại" }));
    await screen.findByText(
      "Chưa thực hiện được thao tác này. Bạn thử lại nhé. Nếu vẫn gặp lỗi, hãy liên hệ quản trị viên.",
    );
    // Changing detail selection must not discard the board's failed operation.
    fireEvent.click(screen.getByRole("button", { name: /Mở hồ sơ của Other/ }));
    await screen.findByText("Lịch sử");
    expect(screen.getByRole("alert").textContent).toContain(
      "Chưa thực hiện được thao tác này",
    );
    fireEvent.click(
      screen.getAllByRole("button", {
        name: /Thử lại chuyển (sang )?Sơ loại/,
      })[0],
    );
    await waitFor(() => expect(api.screen).toHaveBeenCalledTimes(2));
    expect(api.screen.mock.calls[1]).toEqual(api.screen.mock.calls[0]);
    expect(api.screen.mock.calls[1][0]).toBe("Ada");
  });
  it("clears the board on a forbidden drop without offering a retry", async () => {
    api.list.mockResolvedValue({
      applications: [application("Ada")],
      limit: 25,
      offset: 0,
    });
    api.screen.mockRejectedValue(new ApiError("Denied", 403));
    await renderPipeline();
    fireEvent.click(screen.getByRole("button", { name: "Đóng chi tiết" }));
    fireEvent.dragStart(
      await screen.findByRole("button", { name: /Mở hồ sơ của Ada/ }),
    );
    fireEvent.drop(screen.getByRole("region", { name: "Giai đoạn Sơ loại" }));
    expect(await screen.findByText(/Không có quyền/)).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: /Mở hồ sơ của Ada/ }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Thử lại chuyển (sang )?Sơ loại/ }),
    ).toBeNull();
  });
});

it("hides a prior board error when detail access is revoked", async () => {
  api.list.mockResolvedValue({
    applications: [application("Ada"), application("Other")],
    limit: 25,
    offset: 0,
  });
  api.screen.mockRejectedValue(new Error("Network failed"));
  api.detail
    .mockResolvedValueOnce(detail("Ada"))
    .mockRejectedValue(new ApiError("Denied", 403));
  await renderPipeline();
  fireEvent.dragStart(
    await screen.findByRole("button", { name: /Mở hồ sơ của Ada/ }),
  );
  fireEvent.drop(screen.getByRole("region", { name: "Giai đoạn Sơ loại" }));
  await screen.findByText(
    "Chưa thực hiện được thao tác này. Bạn thử lại nhé. Nếu vẫn gặp lỗi, hãy liên hệ quản trị viên.",
  );
  fireEvent.click(screen.getByRole("button", { name: /Mở hồ sơ của Other/ }));
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toContain("Không có quyền"),
  );
  expect(
    screen.queryByText(
      "Chưa thực hiện được thao tác này. Bạn thử lại nhé. Nếu vẫn gặp lỗi, hãy liên hệ quản trị viên.",
    ),
  ).toBeNull();
  expect(
    screen.queryByRole("button", { name: /Thử lại chuyển (sang )?Sơ loại/ }),
  ).toBeNull();
  expect(screen.queryByRole("button", { name: /Mở hồ sơ của Ada/ })).toBeNull();
});

// Exercise a language switch while the board and candidate drawer stay open.
import { LanguageProvider, useLanguage } from "../components/language";
function LanguageSwitch() {
  const { setLocale } = useLanguage();
  return (
    <>
      <button onClick={() => setLocale("en")}>English UI</button>
      <button onClick={() => setLocale("vi")}>Vietnamese UI</button>
    </>
  );
}
it("switches the live pipeline and open detail between Vietnamese and English without changing data", async () => {
  localStorage.clear();
  api.list.mockResolvedValue({
    applications: [application("Nguyễn An")],
    limit: 25,
    offset: 0,
  });
  api.detail.mockResolvedValue(detail("Nguyễn An"));
  render(
    <LanguageProvider>
      <LanguageSwitch />
      <ApplicationPipeline
        job={job}
        onSessionLost={vi.fn()}
        canManageApplications
      />
    </LanguageProvider>,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Kanban" }));
  fireEvent.click(
    await screen.findByRole("button", { name: /Mở hồ sơ của Nguyễn An/ }),
  );
  await screen.findByRole("heading", { name: "Lịch sử" });
  fireEvent.click(screen.getByRole("button", { name: "English UI" }));
  expect(screen.getByRole("heading", { name: "Hiring progress" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "History" })).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Move to Screening" }),
  ).toBeTruthy();
  expect(
    screen.getByRole("textbox", { name: "Search candidates in this job" }),
  ).toBeTruthy();
  expect(
    screen.getByRole("button", { name: /Open Nguyễn An’s profile/ }),
  ).toBeTruthy();
  expect(document.documentElement.lang).toBe("en");
  fireEvent.click(screen.getByRole("button", { name: "Vietnamese UI" }));
  expect(
    screen.getByRole("heading", { name: "Tiến độ tuyển dụng" }),
  ).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Chuyển sang Sơ loại" }),
  ).toBeTruthy();
  expect(document.documentElement.lang).toBe("vi");
  expect(api.screen).not.toHaveBeenCalled();
  expect(api.list).toHaveBeenCalledTimes(1);
});
it("filters the current page by source without changing full-job overview totals", async () => {
  api.list.mockResolvedValue({
    applications: [
      { ...application("Ada"), source: "Referral" },
      { ...application("Lin"), source: "LinkedIn" },
    ],
    limit: 25,
    offset: 0,
  });
  render(
    <ApplicationPipeline
      job={{
        ...job,
        metrics: {
          total_candidates: 42,
          new_count: 40,
          screening_count: 0,
          interview_count: 0,
          hired_count: 2,
          rejected_count: 0,
          source_summary: [],
        },
      }}
      onSessionLost={vi.fn()}
    />,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Kanban" }));
  await screen.findByRole("button", { name: /Mở hồ sơ của Ada/ });
  fireEvent.change(
    screen.getByRole("combobox", { name: "Lọc nguồn ứng viên" }),
    { target: { value: "Referral" } },
  );
  expect(screen.queryByRole("button", { name: /Mở hồ sơ của Lin/ })).toBeNull();
  expect(
    screen.getByRole("region", { name: "Tổng quan Job đang chọn" }).textContent,
  ).toContain("40");
});

it("opens candidate entry as a dismissible dialog from the Pipeline button", async () => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value() {
      this.setAttribute("open", "");
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value() {
      this.removeAttribute("open");
    },
  });
  try {
    api.list.mockResolvedValue({ applications: [], limit: 25, offset: 0 });
    await renderPipeline();
    const trigger = await screen.findByRole("button", {
      name: "Thêm ứng viên",
    });
    expect(trigger.getAttribute("aria-haspopup")).toBe("dialog");
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(trigger);
    expect(
      screen.getByRole("dialog", { name: "Thêm ứng viên vào Job" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Đóng" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.style.overflow).toBe("");
  } finally {
    cleanup();
    Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
    Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
  }
});

it("keeps compact cards free of duplicate source and current-stage labels", async () => {
  api.list.mockResolvedValue({
    applications: [
      {
        ...application("Long candidate name for compact card"),
        source: "Unique source for compact card",
      },
    ],
    limit: 25,
    offset: 0,
  });
  await renderPipeline();
  const card = await screen.findByRole("button", {
    name: /Mở hồ sơ của Long candidate/,
  });
  expect(
    card.textContent?.split("Unique source for compact card"),
  ).toHaveLength(2);
  expect(card.textContent).not.toContain("BƯỚC HIỆN TẠI");
  expect(card.textContent).not.toContain("Đang xử lý");
  expect(card.getAttribute("title")).toContain(
    "Long candidate name for compact card",
  );
});

it("refreshes totals after a successful move and retries only the read when totals fail", async () => {
  api.list.mockResolvedValue({
    applications: [application("Ada")],
    limit: 25,
    offset: 0,
  });
  api.detail.mockResolvedValue(detail("Ada"));
  api.screen.mockResolvedValue({
    application: { application_id: "Ada", changed: true },
  });
  const refresh = vi
    .fn()
    .mockRejectedValueOnce(new Error("network failed"))
    .mockResolvedValue(undefined);
  render(
    <ApplicationPipeline
      job={job}
      onSessionLost={vi.fn()}
      canManageApplications
      onDataChanged={refresh}
    />,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Kanban" }));
  fireEvent.click(
    await screen.findByRole("button", { name: /Mở hồ sơ của Ada/ }),
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Chuyển sang Sơ loại" }),
  );
  expect((await screen.findByRole("alert")).textContent).toContain(
    "Đã lưu thay đổi nhưng chưa tải lại được số liệu tổng quan.",
  );
  expect(api.screen).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Tải lại số liệu" }));
  await waitFor(() => expect(refresh).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  expect(api.screen).toHaveBeenCalledTimes(1);
});
