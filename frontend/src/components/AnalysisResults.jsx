function Card({ children, tone = "neutral" }) {
  const tones = {
    danger: "border-risk/25",
    success: "border-good/25",
    neutral: "border-line",
    error: "border-risk/30",
  };

  return (
    <section
      className={`rounded-2xl border ${tones[tone]} bg-surface-raised p-5 shadow-lg shadow-ink/5 sm:p-6`}
    >
      {children}
    </section>
  );
}

function Kicker({ children }) {
  return (
    <p className="mb-2 text-xs font-bold tracking-[0.12em] text-brand">
      {children}
    </p>
  );
}

export function ResultSummary({ result }) {
  const isScam = result.label_id === 1;
  return (
    <Card tone={isScam ? "danger" : "success"}>
      <Kicker>HASIL PEMERIKSAAN</Kicker>
      <h2 className="font-display text-lg font-extrabold leading-snug text-ink sm:text-xl">
        {isScam ? "Terdeteksi sebagai penipuan" : "Terklasifikasi sebagai normal"}
      </h2>
      <p className="mt-2 text-sm leading-6 text-muted">
        {isScam
          ? "Waspadai permintaan uang, tautan, data pribadi, atau kode OTP."
          : "Tetap periksa konteks dan identitas pengirim secara mandiri."}
      </p>
      <div className="mt-4 flex items-end justify-between border-t border-line pt-3">
        <span className="text-xs font-bold tracking-widest text-muted">SKOR MODEL</span>
        <strong className="font-display text-2xl text-ink">{Number(result.confidence_percent).toFixed(1)}%</strong>
      </div>
      <p className="mt-3 text-sm leading-6 text-muted">
        Skor ini petunjuk awal, bukan jaminan keamanan.
      </p>
    </Card>
  );
}

export function LinkAnalysis({ result }) {
  const check = result.heuristic_check;
  const safeBrowsing = result.url_check;
  if (check.status === "no_urls") return null;

  return (
    <Card tone={check.status === "suspicious" || safeBrowsing.status === "unsafe" ? "danger" : "success"}>
      <Kicker>ANALISIS TAUTAN</Kicker>
      <h2 className="font-display text-base font-extrabold text-ink">
        {check.status === "suspicious" || safeBrowsing.status === "unsafe"
          ? "Ada indikator yang perlu diwaspadai"
          : "Belum ditemukan indikator berbahaya"}
      </h2>
      <p className="mt-2 text-sm leading-6 text-muted">
        {check.urls_checked} tautan diperiksa dengan aturan heuristik.
        {safeBrowsing.status === "safe" && " Google Safe Browsing tidak menemukan ancaman yang dikenal."}
        {safeBrowsing.status === "unavailable" && " Pemeriksaan Google Safe Browsing sedang tidak tersedia."}
        {safeBrowsing.status === "not_configured" && " Google Safe Browsing belum dikonfigurasi."}
      </p>
      {check.matches.map((match) => (
        <p className="mt-3 break-all rounded-xl bg-risk-soft p-3 text-sm leading-6 text-risk" key={match.url}>
          <span className="font-bold">{match.url}</span>
          <br />
          {match.reason}
        </p>
      ))}
      {safeBrowsing.matches?.map((match) => (
        <p className="mt-3 break-all rounded-xl bg-risk-soft p-3 text-sm leading-6 text-risk" key={`${match.url}-${match.threat_type}`}>
          <span className="font-bold">{match.url}</span>
          <br />
          Ditandai Google Safe Browsing sebagai {match.threat_type}.
        </p>
      ))}
    </Card>
  );
}

export function ExplanationCard({ title, explanation, error }) {
  if (error) {
    return (
      <Card tone="error">
        <Kicker>{title}</Kicker>
        <p className="text-sm leading-6 text-risk">{error}</p>
      </Card>
    );
  }
  if (!explanation) return null;

  return (
    <Card>
      <Kicker>{title}</Kicker>
      <p className="whitespace-pre-line text-sm leading-6 text-ink">{explanation}</p>
    </Card>
  );
}
