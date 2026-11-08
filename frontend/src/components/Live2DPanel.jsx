import { useEffect, useState } from "react";
import { getCsrfToken } from "../lib/api.js";

const scripts = [
  "https://cdn.jsdelivr.net/npm/pixi.js@6.5.10/dist/browser/pixi.min.js",
  "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js",
  "https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js",
  "https://cdn.jsdelivr.net/npm/pixi-live2d-display@0.4.0/dist/cubism4.min.js",
  "/static/deteksi/live2d.js?v=3",
];

let live2dScriptsPromise;

function loadScript(source) {
  const existing = document.querySelector(`script[data-live2d-source="${source}"]`);
  if (existing?.dataset.loaded === "true") return Promise.resolve();
  if (existing) existing.remove();

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.dataset.live2dSource = source;
    script.src = source;
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => {
      script.remove();
      reject(new Error("Pustaka karakter tidak termuat. Periksa koneksi internet."));
    };
    document.body.appendChild(script);
  });
}

export default function Live2DPanel({ greeting }) {
  const [loadingMessage, setLoadingMessage] = useState("Memuat pustaka karakter...");

  useEffect(() => {
    let active = true;
    live2dScriptsPromise ??= getCsrfToken().then(() =>
      scripts.reduce(
        (pending, source) => pending.then(() => loadScript(source)),
        Promise.resolve(),
      ),
    );

    live2dScriptsPromise
      .then(() => {
        if (active) setLoadingMessage("");
      })
      .catch((error) => {
        live2dScriptsPromise = undefined;
        if (active) setLoadingMessage(error.message);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <section aria-label="Karakter Cynthia" className="character-stage relative min-h-0 w-full flex-1">
      <div
        aria-label="Area karakter Live2D"
        className="absolute inset-0 overflow-hidden"
        id="live2d-stage"
      >
        {greeting && (
          <div
            className="character-greeting absolute left-3 top-3 z-10 max-w-[min(40%,28rem)] rounded-2xl border border-line/70 bg-surface-raised/90 px-3 py-2.5 text-left text-sm leading-5 text-ink shadow-sm backdrop-blur-sm sm:left-6 sm:top-5 sm:px-4 sm:text-base"
            role="status"
          >
            {greeting}
          </div>
        )}
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center px-6 text-center"
          data-default-model-url="/static/deteksi/live2d/cynthia.zip?v=1"
          id="live2d-empty"
        >
          <p className="font-display text-lg font-semibold text-ink">Cynthia</p>
          <p className="mt-1 text-sm text-muted" id="live2d-status" role="status" aria-live="polite">
            {loadingMessage}
          </p>
        </div>

      </div>
    </section>
  );
}
