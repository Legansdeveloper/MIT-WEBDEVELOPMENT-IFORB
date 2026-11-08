export default function AnalysisForm({
  text,
  file,
  busy,
  hasResult,
  onTextChange,
  onFileChange,
  onSubmit,
}) {
  function handleDrop(event) {
    event.preventDefault();
    const droppedFile = event.dataTransfer.files[0];
    if (droppedFile) onFileChange(droppedFile);
  }

  return (
    <form
      className="mx-auto mb-2 w-full max-w-4xl shrink-0 rounded-2xl border border-line bg-surface-raised p-2 shadow-lg shadow-ink/10 sm:mb-4 sm:p-3"
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
      onKeyDown={(event) => {
        if (event.key === "Enter" && !event.shiftKey && event.target.id === "chat-text") {
          event.preventDefault();
          event.currentTarget.requestSubmit();
        }
      }}
      onSubmit={onSubmit}
    >
      <textarea
        aria-label="Isi pesan"
        className="block max-h-28 min-h-14 w-full resize-none overflow-y-auto rounded-xl bg-transparent px-3 py-2 text-base leading-6 text-ink outline-none placeholder:text-subtle focus-visible:outline-2 focus-visible:outline-brand sm:min-h-16"
        id="chat-text"
        name="chat_text"
        placeholder="Tempel pesan di sini..."
        rows={2}
        value={text}
        onChange={(event) => onTextChange(event.target.value)}
      />

      {file && (
        <div className="mx-2 mb-2 flex min-w-0 items-center gap-2 rounded-lg bg-brand-soft px-3 py-1.5 text-sm text-brand-ink">
          <span className="min-w-0 flex-1 truncate">{file.name}</span>
          <button
            aria-label="Hapus PDF"
            className="shrink-0 rounded px-1 font-semibold hover:text-risk"
            onClick={() => onFileChange(null)}
            type="button"
          >
            Hapus
          </button>
        </div>
      )}

      <div className="flex min-h-11 flex-wrap items-center gap-2 border-t border-line px-1 pt-2">
        <label
          className="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-full px-3 text-sm font-medium text-muted transition hover:bg-page hover:text-ink"
          title="PDF dengan teks, maksimal 20 MB"
        >
          <span aria-hidden="true" className="mr-2 text-base">＋</span>
          <span>PDF</span>
          <input
            accept=".pdf,application/pdf"
            className="sr-only"
            id="pdf-file"
            onChange={(event) => onFileChange(event.target.files?.[0] || null)}
            type="file"
          />
        </label>
        <span className="hidden text-xs text-subtle sm:inline">Jangan masukkan OTP atau kata sandi.</span>
        <span className="min-w-0 flex-1" />
        <span
          className="min-w-0 max-w-36 truncate text-xs text-brand-ink sm:max-w-56"
          id="speech-status"
          role="status"
          aria-live="polite"
        />
        <button
          aria-pressed="false"
          className="min-h-10 rounded-full px-3 text-sm font-medium text-muted transition hover:bg-page hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
          data-speech-url="/api/speak/"
          disabled={!hasResult || busy}
          aria-label="Bacakan hasil"
          id="read-analysis-button"
          type="button"
        >
          <span aria-hidden="true" className="mr-1.5">◖</span>
          <span className="hidden sm:inline">Bacakan hasil</span>
          <span className="sm:hidden">Suara</span>
        </button>
        <button
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-ink disabled:cursor-wait disabled:opacity-60 sm:px-5"
          disabled={busy || (!text.trim() && !file)}
          type="submit"
        >
          {busy ? "Memeriksa…" : "Periksa pesan"}
          {!busy && <span aria-hidden="true">↑</span>}
        </button>
      </div>
    </form>
  );
}
