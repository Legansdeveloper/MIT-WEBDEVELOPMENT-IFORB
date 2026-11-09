/** @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App.jsx";
import { analyzeMessage, getCsrfToken } from "./lib/api.js";

vi.mock("./lib/api.js", () => ({
  analyzeMessage: vi.fn(),
  getCsrfToken: vi.fn().mockResolvedValue("test-csrf-token"),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Cynthia", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(),
      setItem: vi.fn(),
    });
    delete document.documentElement.dataset.theme;
  });

  it("submits a chat and displays the IndoBERT result", async () => {
    analyzeMessage.mockResolvedValue({
      result: {
        label_id: 1,
        label: "Penipuan",
        confidence_percent: 95,
        heuristic_check: { status: "no_urls", matches: [], urls_checked: 0 },
        url_check: { status: "no_urls", matches: [], urls_checked: 0 },
        groq_explanation: "Jangan kirim kode OTP kepada siapa pun.",
      },
      errors: {},
    });

    const { container } = render(<App />);
    fireEvent.change(screen.getByLabelText("Isi pesan"), {
      target: { value: "Segera kirim kode OTP Anda" },
    });
    fireEvent.keyDown(screen.getByLabelText("Isi pesan"), {
      key: "Enter",
      code: "Enter",
    });

    await waitFor(() => {
      expect(analyzeMessage).toHaveBeenCalledOnce();
    });
    expect(await screen.findByText("Terdeteksi sebagai penipuan")).toBeInTheDocument();
    expect(screen.getByText("Jangan kirim kode OTP kepada siapa pun.")).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute("data-scene", "danger");
    expect(screen.queryByText(/Hai, aku Cynthia/)).not.toBeInTheDocument();
    expect(container.firstChild).toHaveClass("h-dvh", "overflow-hidden");
    const layout = screen.getByRole("main");
    expect(layout).toHaveClass("grid-cols-1", "overflow-y-auto", "lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]");
    expect(screen.getByLabelText("Hasil pemeriksaan")).toHaveClass("row-start-3", "lg:col-start-2");
    expect(screen.getByLabelText("Isi pesan").closest("div")).toHaveClass("row-start-2");
    expect(screen.getByRole("complementary", { name: "Hasil pemeriksaan" })
      .querySelector("#analysis-results")).toHaveClass("overflow-y-auto");
    fireEvent.click(screen.getByRole("button", { name: "Sembunyikan hasil pemeriksaan" }));
    expect(screen.getByLabelText("Hasil pemeriksaan")).toHaveClass("hidden");
    expect(screen.getByLabelText("Hasil pemeriksaan")).toHaveTextContent("Jangan kirim kode OTP");
    fireEvent.click(screen.getByRole("button", { name: "Tampilkan hasil pemeriksaan" }));
    expect(screen.getByRole("complementary", { name: "Hasil pemeriksaan" })).toBeInTheDocument();
    expect(getCsrfToken).toHaveBeenCalled();
  });

  it("shows a clear error returned by the backend", async () => {
    analyzeMessage.mockRejectedValue(new Error("Masukkan isi chat terlebih dahulu."));

    render(<App />);
    fireEvent.change(screen.getByLabelText("Isi pesan"), {
      target: { value: "Tolong periksa pesan ini" },
    });
    fireEvent.click(screen.getByRole("button", { name: /periksa pesan/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Masukkan isi chat terlebih dahulu.",
    );
  });

  it("keeps Enter+Shift for a newline without submitting", () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText("Isi pesan"), {
      target: { value: "Baris pertama" },
    });
    fireEvent.keyDown(screen.getByLabelText("Isi pesan"), {
      key: "Enter",
      code: "Enter",
      shiftKey: true,
    });
    expect(analyzeMessage).not.toHaveBeenCalled();
  });

  it("opens settings and applies dark mode", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Buka menu" }));
    fireEvent.click(screen.getByLabelText("Mode gelap"));
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(localStorage.setItem).toHaveBeenCalledWith("cynthia-theme", "dark");
    expect(screen.getByRole("link", { name: "Lisensi dan sumber aset" })).toHaveAttribute(
      "href",
      "https://www.live2d.com/download/sample-data/",
    );
  });

  it("morphs the menu control and dismisses settings with Escape or an outside click", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Buka menu" }));
    expect(screen.getByRole("button", { name: "Tutup menu" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("dialog", { name: "Menu pengaturan" })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Menu pengaturan" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Buka menu" }));
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("dialog", { name: "Menu pengaturan" })).not.toBeInTheDocument();
  });

  it("greets the user before the first message is submitted", () => {
    render(<App />);
    expect(screen.getByText("Hai, aku Cynthia. Kirim pesan yang ingin kamu periksa, ya.")).toBeInTheDocument();
  });
});
