(() => {
  const stage = document.getElementById("live2d-stage");
  const emptyState = document.getElementById("live2d-empty");
  const status = document.getElementById("live2d-status");
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
  let pendingReaction = true;
  let lastReactionAt = 0;

  function playReaction() {
    if (!live2dModel || typeof live2dModel.motion !== "function") return;
    const now = Date.now();
    if (now - lastReactionAt < 700) return;
    lastReactionAt = now;
    const motionIndex = Math.floor(Math.random() * 26) + 1;
    try {
      live2dModel.motion("", motionIndex, 2)?.catch((error) => {
        console.warn("Haru motion could not be played", error);
      });
    } catch (error) {
      console.warn("Haru motion could not be played", error);
    }
  }

  function onReaction() {
    if (!live2dModel) pendingReaction = true;
    playReaction();
  }

  window.addEventListener("cynthia:reaction", onReaction);
  window.addEventListener("cynthia:tap", playReaction);
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
    pixiApp.view.setAttribute("role", "button");
    pixiApp.view.setAttribute("tabindex", "0");
    pixiApp.view.setAttribute("title", "Klik karakter untuk menyapanya");
    pixiApp.view.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        playReaction();
        window.dispatchEvent(new CustomEvent("cynthia:tap"));
      }
    });
    stage.insertBefore(pixiApp.view, emptyState);
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
    if (!live2dModel || !pixiApp || !modelNaturalSize) return;

    const scale = modelFitScale * 2;
    const faceHeight = pixiApp.screen.height * 0.28;
    const facePositionInModel = 0.17;
    live2dModel.scale.set(scale);
    live2dModel.position.set(
      pixiApp.screen.width / 2,
      faceHeight + modelNaturalSize.height * scale * (0.5 - facePositionInModel),
    );
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
    if (speaking) playReaction();
    readAnalysisButton.classList.toggle("is-speaking", speaking);
    readAnalysisButton.setAttribute("aria-pressed", String(speaking));
    readAnalysisButton.setAttribute("aria-label", speaking ? "Hentikan bacaan" : "Bacakan hasil");
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
    readAnalysisButton.setAttribute("aria-label", "Bacakan hasil");
    speechStatus.textContent = message;
  }

  function getAnalysisText() {
    const results = document.getElementById("analysis-results");
    if (!results) return "";
    const spokenResults = results.cloneNode(true);
    spokenResults.querySelectorAll("button").forEach((button) => button.remove());
    return spokenResults.textContent.replace(/\s+/g, " ").trim();
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
        const csrfToken = document.querySelector("[name=csrfmiddlewaretoken]")?.value
          || document.cookie.split("; ").find((cookie) => cookie.startsWith("csrftoken="))?.slice("csrftoken=".length);
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

  async function loadModel(file) {
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
      live2dModel.interactive = true;
      live2dModel.on("pointertap", () => {
        playReaction();
        window.dispatchEvent(new CustomEvent("cynthia:tap"));
      });
      positionModel();
      emptyState.classList.add("is-hidden");
      setStatus("");
      if (pendingReaction) {
        playReaction();
        pendingReaction = false;
      }
    } catch (error) {
      console.error("Live2D model load failed", error);
      setStatus("Karakter Haru gagal dimuat. Muat ulang halaman untuk mencoba kembali.", true);
    } finally {
      isLoading = false;
      emptyState.classList.remove("is-loading");
    }
  }

  async function loadDefaultModel() {
    const modelUrl = emptyState.dataset.defaultModelUrl;
    if (!modelUrl) return;

    setStatus("Memuat karakter Haru…");
    try {
      const response = await fetch(modelUrl);
      if (!response.ok) {
        throw new Error(`Model Haru gagal dimuat (HTTP ${response.status}).`);
      }
      const modelBlob = await response.blob();
      const modelFile = new File([modelBlob], "haru-live2d.zip", {
        type: "application/zip",
      });
      loadModel(modelFile);
    } catch (error) {
      console.error("Default Live2D model load failed", error);
      setStatus("Karakter Haru belum bisa dimuat. Periksa koneksi lalu muat ulang halaman.", true);
    }
  }

  readAnalysisButton?.addEventListener("click", speakAnalysis);

  window.addEventListener("resize", positionModel);
  const stageResizeObserver = new ResizeObserver(() => {
    window.requestAnimationFrame(positionModel);
  });
  stageResizeObserver.observe(stage);

  loadDefaultModel();
})();
