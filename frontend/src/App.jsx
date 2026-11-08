import { useEffect, useRef, useState } from "react";
import AnalysisForm from "./components/AnalysisForm.jsx";
import {
  ExplanationCard,
  LinkAnalysis,
  ResultSummary,
} from "./components/AnalysisResults.jsx";
import Live2DPanel from "./components/Live2DPanel.jsx";
import { analyzeMessage, getCsrfToken } from "./lib/api.js";

function getResultScene(result) {
  if (!result) return "neutral";

  const hasThreat =
    Number(result.label_id) === 1 ||
    result.heuristic_check?.status === "suspicious" ||
    result.url_check?.status === "unsafe";
  if (hasThreat) return "danger";

  const confidence = Number(result.confidence_percent);
  if (
    (!Number.isFinite(confidence) || confidence < 70) ||
    ["unavailable", "not_configured"].includes(result.url_check?.status)
  ) {
    return "caution";
  }
  return "safe";
}

export default function App() {
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [characterGreeting, setCharacterGreeting] = useState("");
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("cynthia-theme") === "dark" ? "dark" : "light";
    } catch {
      return "light";
    }
  });
  const greetingTimeout = useRef(0);
  const menuContainer = useRef(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("cynthia-theme", theme);
    } catch {
      // Theme still applies for this session when storage is unavailable.
    }
  }, [theme]);

  useEffect(() => {
    const scene = getResultScene(analysis?.result);
    document.documentElement.dataset.scene = scene;
    if (analysis?.result) {
      window.dispatchEvent(new CustomEvent("cynthia:reaction", { detail: { mood: scene } }));
    }
  }, [analysis]);

  useEffect(() => {
    function handleCharacterTap() {
      window.clearTimeout(greetingTimeout.current);
      setCharacterGreeting("Hehe, aku di sini. Mau periksa pesan apa?");
      greetingTimeout.current = window.setTimeout(() => setCharacterGreeting(""), 3200);
    }
    window.addEventListener("cynthia:tap", handleCharacterTap);
    return () => {
      window.clearTimeout(greetingTimeout.current);
      window.removeEventListener("cynthia:tap", handleCharacterTap);
    };
  }, []);

  useEffect(() => {
    getCsrfToken().catch((csrfError) => setError(csrfError.message));
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;
    function dismissMenu(event) {
      if (event.key === "Escape" || (event.type === "pointerdown" && !menuContainer.current?.contains(event.target))) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("pointerdown", dismissMenu);
    document.addEventListener("keydown", dismissMenu);
    return () => {
      document.removeEventListener("pointerdown", dismissMenu);
      document.removeEventListener("keydown", dismissMenu);
    };
  }, [menuOpen]);

  function selectPdf(nextFile) {
    if (nextFile && !nextFile.name.toLowerCase().endsWith(".pdf")) {
      setError("Pilih file dengan ekstensi .pdf.");
      setResultsOpen(true);
      return;
    }
    setError("");
    setFile(nextFile);
    const input = document.getElementById("pdf-file");
    if (input && !nextFile) input.value = "";
  }

  async function submitAnalysis(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setAnalysis(null);
    setResultsOpen(true);
    setHasSubmitted(true);
    setCharacterGreeting("");

    const formData = new FormData();
    formData.set("chat_text", text);
    if (file) formData.set("pdf_file", file);

    try {
      setAnalysis(await analyzeMessage(formData));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  const result = analysis?.result;
  const hasAnalysisPanel = Boolean(error || result);

  return (
    <div className="flex h-dvh flex-col overflow-hidden px-3 text-ink sm:px-6">
      <header className="mx-auto flex h-14 w-full max-w-[1500px] shrink-0 items-center justify-between gap-4 border-b border-line/70">
        <a className="font-display text-base font-extrabold tracking-tight text-ink sm:text-lg" href="/">
          Cynthia<span className="text-brand">.</span>
        </a>
        <div className="relative" ref={menuContainer}>
          <button
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Tutup menu" : "Buka menu"}
            className="menu-toggle grid size-10 place-items-center rounded-full text-ink transition-colors hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-brand"
            onClick={() => setMenuOpen((open) => !open)}
            type="button"
          >
            <span className="menu-toggle-lines" aria-hidden="true">
              <span className={menuOpen ? "menu-line menu-line-top is-open" : "menu-line menu-line-top"} />
              <span className={menuOpen ? "menu-line menu-line-middle is-open" : "menu-line menu-line-middle"} />
              <span className={menuOpen ? "menu-line menu-line-bottom is-open" : "menu-line menu-line-bottom"} />
            </span>
          </button>
          {menuOpen && (
            <div
              aria-label="Menu pengaturan"
              className="settings-menu absolute right-0 top-12 z-50 w-[min(88vw,320px)] rounded-2xl border border-line bg-surface-raised p-4 text-sm shadow-xl shadow-ink/15"
              role="dialog"
            >
              <h2 className="font-semibold text-ink">Pengaturan</h2>
              <label className="mt-3 flex min-h-11 cursor-pointer items-center justify-between gap-3 border-b border-line pb-3 text-ink">
                <span>Mode gelap</span>
                <input
                  checked={theme === "dark"}
                  className="size-4 accent-brand"
                  onChange={(event) => setTheme(event.target.checked ? "dark" : "light")}
                  type="checkbox"
                />
              </label>
              <div className="pt-3 leading-6 text-muted">
                <p className="font-medium text-ink">Tentang Cynthia</p>
                <p className="mt-1">Karakter Haru: desain dan model © Live2D.</p>
                <a
                  className="mt-2 inline-block font-medium text-brand underline underline-offset-2 hover:text-brand-ink"
                  href="https://www.live2d.com/download/sample-data/"
                  rel="noreferrer"
                  target="_blank"
                >
                  Lisensi dan sumber aset
                </a>
                <p className="mt-2 text-xs">
                  Penggunaan karakter mengikuti perjanjian lisensi materi sampel Live2D.
                </p>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="relative mx-auto flex w-full max-w-[1500px] min-h-0 flex-1 gap-6 py-2 sm:py-4">
        <section className="flex min-w-0 flex-1 flex-col items-center">
          <Live2DPanel
            greeting={
              characterGreeting || (!hasSubmitted ? "Hai, aku Cynthia. Kirim pesan yang ingin kamu periksa, ya." : "")
            }
          />
        </section>

        <aside
          aria-label="Hasil pemeriksaan"
          className={hasAnalysisPanel && resultsOpen
            ? "analysis-panel absolute right-0 top-2 z-20 flex max-h-[52%] min-h-0 w-[min(94%,440px)] flex-col overflow-hidden rounded-xl border border-line bg-surface-raised/95 shadow-xl shadow-ink/15 backdrop-blur-md sm:top-4 lg:static lg:top-auto lg:max-h-full lg:w-[min(36%,380px)] lg:shrink-0 lg:rounded-none lg:border-0 lg:border-l lg:bg-transparent lg:pl-4 lg:shadow-none lg:backdrop-blur-none"
            : "hidden"}
        >
            <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-line px-3 sm:px-4 lg:pl-4">
              <h2 className="text-sm font-semibold text-ink">Hasil pemeriksaan</h2>
              <button
                aria-label="Sembunyikan hasil pemeriksaan"
                className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full border border-line bg-page px-3 text-xs font-medium text-ink transition-colors hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-brand"
                onClick={() => setResultsOpen(false)}
                type="button"
              >
                <span>Sembunyikan</span>
              </button>
            </div>
            <div
              aria-live="polite"
              className="analysis-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain p-3 sm:p-4 lg:pl-4 lg:pr-1"
              id="analysis-results"
              tabIndex={0}
            >
              {error && (
                <section className="shrink-0 rounded-xl border border-risk/25 bg-risk-soft p-4 text-sm text-risk" role="alert">
                  <h3 className="font-bold">Belum bisa memeriksa</h3>
                  <p className="mt-1 leading-6">{error}</p>
                </section>
              )}
              {result && (
                <>
                  <ResultSummary result={result} />
                  <LinkAnalysis result={result} />
                  <ExplanationCard
                    title="Penjelasan tautan"
                    explanation={result.url_groq_explanation}
                    error={analysis.errors?.url_explanation}
                  />
                  <ExplanationCard
                    title="Alasan klasifikasi"
                    explanation={result.groq_explanation}
                    error={analysis.errors?.explanation}
                  />
                </>
              )}
            </div>
        </aside>
        {hasAnalysisPanel && !resultsOpen && (
          <button
            className="absolute right-0 top-2 z-20 rounded-full border border-line bg-surface-raised px-4 py-2 text-sm font-medium text-ink shadow-lg shadow-ink/10 transition hover:bg-brand-soft sm:top-4"
            aria-label="Tampilkan hasil pemeriksaan"
            onClick={() => setResultsOpen(true)}
            type="button"
          >
            Tampilkan hasil
          </button>
        )}
      </main>

      <AnalysisForm
        busy={busy}
        file={file}
        hasResult={Boolean(result)}
        onFileChange={selectPdf}
        onSubmit={submitAnalysis}
        onTextChange={setText}
        text={text}
      />
    </div>
  );
}
