(() => {
  const stage = document.getElementById("live2d-stage");
  const emptyState = document.getElementById("live2d-empty");
  const fileInput = document.getElementById("live2d-file");
  const uploadButton = document.getElementById("live2d-upload-button");
  const changeButton = document.getElementById("live2d-change-button");
  const status = document.getElementById("live2d-status");
  const zoomControls = document.getElementById("live2d-controls");
  const zoomSlider = document.getElementById("live2d-zoom");
  const zoomValue = document.getElementById("live2d-zoom-value");
  const zoomOutButton = document.getElementById("live2d-zoom-out");
  const zoomInButton = document.getElementById("live2d-zoom-in");
  const zoomResetButton = document.getElementById("live2d-zoom-reset");
  const readAnalysisButton = document.getElementById("read-analysis-button");
  const speechStatus = document.getElementById("speech-status");

  let pixiApp;
  let live2dModel;
  let modelNaturalSize;
  let modelFitScale = 1;
  let isLoading = false;
  let speechActive = false;
  let speechFrame = 0;
  let isSpeaking = false;
  let speechRunId = 0;
  let currentAudio = null;
  let currentAudioUrl = null;
  let speechAbortController = null;
  const dbName = "ruang-aman-live2d";
  const dbStore = "models";
  const modelKey = "last-model";

  function setStatus(message, isError = false) {
    status.textContent = message;
    status.classList.toggle("is-error", isError);
  }

  function configureZipLoader() {
    const zipLoader = window.PIXI?.live2d?.ZipLoader;
    if (!zipLoader || !window.JSZip) return false;

    zipLoader.zipReader = (data) => window.JSZip.loadAsync(data);
    zipLoader.readText = (zip, path) => zip.file(path).async("text");
    zipLoader.getFilePaths = (zip) => {
      const paths = [];
      zip.forEach((path) => paths.push(path));
      return Promise.resolve(paths);
    };
    zipLoader.getFiles = (zip, paths) => Promise.all(paths.map(async (path) => {
      const blob = await zip.file(path).async("blob");
      return new File([blob], path.slice(path.lastIndexOf("/") + 1));
    }));
    return true;
  }

  function initializePixi() {
    if (pixiApp) return;
    pixiApp = new window.PIXI.Application({
      resizeTo: stage,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
    });
    pixiApp.view.setAttribute("aria-label", "Karakter Live2D");
    stage.insertBefore(pixiApp.view, emptyState);
  }

  function openModelDatabase() {
    return new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) {
        reject(new Error("Browser tidak mendukung penyimpanan model."));
        return;
      }
      const request = window.indexedDB.open(dbName, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(dbStore)) db.createObjectStore(dbStore, { keyPath: "id" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function storeModelFile(file) {
    const db = await openModelDatabase();
    try {
      const transaction = db.transaction(dbStore, "readwrite");
      transaction.objectStore(dbStore).put({
        id: modelKey,
        name: file.name,
        type: file.type || "application/zip",
        lastModified: file.lastModified || Date.now(),
        blob: file,
      });
      await new Promise((resolve, reject) => {
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
    } finally {
      db.close();
    }
  }

  async function readStoredModel() {
    const db = await openModelDatabase();
    try {
      const transaction = db.transaction(dbStore, "readonly");
      const record = await new Promise((resolve, reject) => {
        const request = transaction.objectStore(dbStore).get(modelKey);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      if (!record?.blob) return null;
      return new File([record.blob], record.name, {
        type: record.type || "application/zip",
        lastModified: record.lastModified || Date.now(),
      });
    } finally {
      db.close();
    }
  }

  function positionModel() {
    if (!pixiApp || !live2dModel) return;
    const width = pixiApp.screen.width;
    const height = pixiApp.screen.height;
    if (!modelNaturalSize?.width || !modelNaturalSize?.height) return;
    modelFitScale = Math.min(
      1,
      (width * 0.88) / modelNaturalSize.width,
      (height * 0.8) / modelNaturalSize.height,
    );
    applyZoom();
  }

  function applyZoom() {
    const zoom = Number(zoomSlider.value) / 100;
    zoomValue.value = `${zoomSlider.value}%`;
    zoomValue.textContent = `${zoomSlider.value}%`;
    if (!live2dModel || !pixiApp || !modelNaturalSize) return;

    const scale = modelFitScale * zoom;
    const faceHeight = pixiApp.screen.height * 0.28;
    const facePositionInModel = 0.17;
    live2dModel.scale.set(scale);
    live2dModel.position.set(
      pixiApp.screen.width / 2,
      faceHeight + modelNaturalSize.height * scale * (0.5 - facePositionInModel),
    );
  }

  function adjustZoom(change) {
    const current = Number(zoomSlider.value);
    zoomSlider.value = String(Math.max(50, Math.min(200, current + change)));
    applyZoom();
  }

  function setMouthOpen(value) {
    const coreModel = live2dModel?.internalModel?.coreModel;
    if (!coreModel) return;
    try {
      coreModel.setParameterValueById("ParamMouthOpenY", value);
    } catch (error) {
      // Some models do not expose a mouth-opening parameter.
    }
  }

  function startLipSync() {
    speechActive = true;
    if (speechFrame) window.cancelAnimationFrame(speechFrame);
    animateMouth();
  }

  function stopLipSync() {
    speechActive = false;
    if (speechFrame) window.cancelAnimationFrame(speechFrame);
    speechFrame = 0;
    setMouthOpen(0);
  }

  function animateMouth() {
    if (!speechActive) return;
    setMouthOpen(0.12 + Math.random() * 0.78);
    speechFrame = window.requestAnimationFrame(animateMouth);
  }

  function setSpeechUi(speaking, message = "") {
    isSpeaking = speaking;
    readAnalysisButton.classList.toggle("is-speaking", speaking);
    readAnalysisButton.setAttribute("aria-pressed", String(speaking));
    readAnalysisButton.textContent = speaking ? "Hentikan suara" : "🔊 ElevenLabs · TTS";
    speechStatus.textContent = message;
  }

  function clearCurrentAudio() {
    if (currentAudioUrl) URL.revokeObjectURL(currentAudioUrl);
    currentAudioUrl = null;
    currentAudio = null;
  }

  function stopSpeech() {
    speechRunId += 1;
    speechAbortController?.abort();
    speechAbortController = null;
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.removeAttribute("src");
      currentAudio.load();
    }
    clearCurrentAudio();
    stopLipSync();
    setSpeechUi(false, "");
  }

  function splitSpeechText(text, maxLength = 180) {
    const words = text.replace(/https?:\/\/\S+|www\.\S+/gi, "tautan tersebut").match(/\S+/g) || [];
    const chunks = [];
    let current = "";
    words.forEach((word) => {
      if (word.length > maxLength) {
        if (current) chunks.push(current);
        for (let index = 0; index < word.length; index += maxLength) {
          chunks.push(word.slice(index, index + maxLength));
        }
        current = "";
        return;
      }
      const next = current ? `${current} ${word}` : word;
      if (next.length > maxLength) {
        chunks.push(current);
        current = word;
      } else {
        current = next;
      }
    });
    if (current) chunks.push(current);
    return chunks;
  }

  function resetSpeechButton(message = "") {
    isSpeaking = false;
    readAnalysisButton.classList.remove("is-speaking");
    readAnalysisButton.setAttribute("aria-pressed", "false");
    readAnalysisButton.textContent = "🔊 ElevenLabs · TTS";
    speechStatus.textContent = message;
  }

  function getAnalysisText() {
    return Array.from(document.querySelectorAll(".analysis-side .feedback"))
      .map((card) => {
        const copy = card.cloneNode(true);
        copy.querySelectorAll(".feedback-symbol, .result-kicker, .confidence").forEach((element) => element.remove());
        return copy.innerText.replace(/\s+/g, " ").trim();
      })
      .filter(Boolean)
      .join(". ");
  }

  async function speakAnalysis() {
    if (isSpeaking) {
      stopSpeech();
      return;
    }

    const text = getAnalysisText();
    if (!text) {
      speechStatus.textContent = "Belum ada hasil untuk dibacakan.";
      return;
    }

    const chunks = splitSpeechText(text);
    const runId = ++speechRunId;
    setSpeechUi(true, `Meminta suara ElevenLabs (1/${chunks.length})…`);

    try {
      for (let index = 0; index < chunks.length; index += 1) {
        if (runId !== speechRunId) return;
        speechAbortController = new AbortController();
        const csrfToken = document.querySelector("[name=csrfmiddlewaretoken]")?.value;
        const response = await fetch(readAnalysisButton.dataset.speechUrl, {
          method: "POST",
          credentials: "same-origin",
          signal: speechAbortController.signal,
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": csrfToken || "",
          },
          body: JSON.stringify({ text: chunks[index] }),
        });
        if (!response.ok) {
          let message = "ElevenLabs TTS gagal membuat suara.";
          try {
            const payload = await response.json();
            if (payload.error) message = payload.error;
          } catch (error) {
            // Keep the general error when the server returns a non-JSON response.
          }
          throw new Error(message);
        }
        if (runId !== speechRunId) return;

        const audioBlob = await response.blob();
        currentAudioUrl = URL.createObjectURL(audioBlob);
        currentAudio = new Audio(currentAudioUrl);
        speechStatus.textContent = `Memutar suara ElevenLabs (${index + 1}/${chunks.length})…`;
        await new Promise((resolve, reject) => {
          currentAudio.addEventListener("play", startLipSync, { once: true });
          currentAudio.addEventListener("ended", resolve, { once: true });
          currentAudio.addEventListener("error", () => reject(new Error("Audio ElevenLabs tidak dapat diputar.")), { once: true });
          currentAudio.addEventListener("pause", () => { if (!isSpeaking) resolve(); }, { once: true });
          currentAudio.play().catch(reject);
        });
        stopLipSync();
        clearCurrentAudio();
      }
      if (runId === speechRunId) {
        setSpeechUi(false, "Selesai dibacakan.");
      }
    } catch (error) {
      if (runId === speechRunId) {
        stopLipSync();
        clearCurrentAudio();
        resetSpeechButton(error.name === "AbortError" ? "" : error.message);
      }
    } finally {
      if (runId === speechRunId) speechAbortController = null;
    }
  }

  async function loadModel(file, { persist = true } = {}) {
    if (isLoading) return;
    if (!file || !file.name.toLowerCase().endsWith(".zip")) {
      setStatus("Pilih ZIP model Live2D.", true);
      return;
    }

    const Live2DModel = window.PIXI?.live2d?.Live2DModel;
    if (!window.PIXI || !Live2DModel || !configureZipLoader()) {
      setStatus("Pustaka Live2D belum termuat. Periksa koneksi lalu muat ulang halaman.", true);
      return;
    }

    isLoading = true;
    emptyState.classList.remove("is-hidden");
    emptyState.classList.add("is-loading");
    setStatus("Memuat karakter Live2D…");

    try {
      initializePixi();
      const nextModel = await Live2DModel.from([file], { autoInteract: false });
      nextModel.anchor.set(0.5, 0.5);
      nextModel.scale.set(1);
      modelNaturalSize = { width: nextModel.width, height: nextModel.height };

      if (live2dModel) {
        pixiApp.stage.removeChild(live2dModel);
        live2dModel.destroy();
      }
      live2dModel = nextModel;
      pixiApp.stage.addChild(live2dModel);
      zoomSlider.value = "100";
      positionModel();
      [zoomSlider, zoomOutButton, zoomInButton, zoomResetButton].forEach((control) => { control.disabled = false; });
      zoomControls.classList.remove("is-hidden");
      if (persist) {
        try {
          await storeModelFile(file);
        } catch (error) {
          console.warn("Model Live2D tidak tersimpan untuk kunjungan berikutnya", error);
        }
      }
      emptyState.classList.add("is-hidden");
      setStatus("");
    } catch (error) {
      console.error("Live2D model load failed", error);
      setStatus("Model gagal dimuat. Pastikan ZIP berisi model3.json, .moc3, dan tekstur.", true);
    } finally {
      isLoading = false;
      emptyState.classList.remove("is-loading");
    }
  }

  uploadButton.addEventListener("click", () => fileInput.click());
  changeButton.addEventListener("click", () => fileInput.click());
  zoomSlider.addEventListener("input", applyZoom);
  zoomOutButton.addEventListener("click", () => adjustZoom(-10));
  zoomInButton.addEventListener("click", () => adjustZoom(10));
  zoomResetButton.addEventListener("click", () => {
    zoomSlider.value = "100";
    applyZoom();
  });
  readAnalysisButton?.addEventListener("click", speakAnalysis);
  fileInput.addEventListener("change", () => {
    const [file] = fileInput.files;
    if (file) loadModel(file);
    fileInput.value = "";
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    stage.addEventListener(eventName, (event) => {
      event.preventDefault();
      stage.classList.add("is-dragging");
    });
  });
  ["dragleave", "drop"].forEach((eventName) => {
    stage.addEventListener(eventName, (event) => {
      event.preventDefault();
      stage.classList.remove("is-dragging");
    });
  });
  stage.addEventListener("drop", (event) => {
    const [file] = event.dataTransfer.files;
    if (file) loadModel(file);
  });

  window.addEventListener("resize", positionModel);

  readStoredModel()
    .then((file) => { if (file) loadModel(file, { persist: false }); })
    .catch((error) => console.warn("Model Live2D tersimpan tidak dapat dibaca", error));
})();
