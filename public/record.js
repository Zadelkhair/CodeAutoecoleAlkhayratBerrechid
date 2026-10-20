const token = new URLSearchParams(location.hash.slice(1)).get("token");
const node = (id) => document.getElementById(id);
let recorder, microphone, file, previewUrl, timer, startedAt;
let active = false;
async function requestAudio(options = {}) {
  const response = await fetch("/api/phone-audio", {
    ...options,
    headers: { Authorization: "Bearer " + token, ...options.headers },
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.message || "Connexion au PC interrompue.");
  return data;
}
function message(text, error = false) {
  node("recordMessage").textContent = text;
  node("recordMessage").classList.toggle("error", error);
}
function selectFile(value) {
  if (value.size > 25 * 1024 * 1024) {
    message(
      "Ce fichier dépasse 25 Mo. Choisissez un enregistrement plus court.",
      true,
    );
    return;
  }
  file = value;
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = URL.createObjectURL(value);
  node("recordPreview").src = previewUrl;
  node("recordPreview").hidden = false;
  node("submitVoice").disabled = false;
  message("Écoutez votre enregistrement, puis envoyez-le au PC.");
}
function stopMicrophone() {
  microphone?.getTracks().forEach((track) => track.stop());
  clearInterval(timer);
}
function stopRecording() {
  if (recorder?.state === "recording") recorder.stop();
}
node("recordVoice").addEventListener("click", async () => {
  if (recorder?.state === "recording") {
    stopRecording();
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    node("secureAdvice").hidden = false;
    message(
      "Utilisez la connexion HTTPS ou l’enregistreur du téléphone.",
      true,
    );
    return;
  }
  try {
    node("recordPreview").pause();
    node("recordTimer").textContent = "00:00";
    node("recordVoice").disabled = true;
    microphone = await navigator.mediaDevices.getUserMedia({ audio: true });
    const type = [
      "audio/mp4",
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
    ].find((value) => MediaRecorder.isTypeSupported(value));
    recorder = new MediaRecorder(microphone, type ? { mimeType: type } : {});
    const chunks = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    recorder.onstop = () => {
      stopMicrophone();
      node("recordVoice").classList.remove("recording");
      node("recordVoice").textContent = "●";
      node("recordVoice").setAttribute(
        "aria-label",
        "Recommencer l’enregistrement",
      );
      node("chooseVoice").disabled = false;
      node("recordHint").textContent = "Vous pouvez réenregistrer si besoin.";
      selectFile(new Blob(chunks, { type: recorder.mimeType || "audio/webm" }));
    };
    recorder.onerror = () => {
      stopMicrophone();
      node("recordVoice").classList.remove("recording");
      node("recordVoice").textContent = "●";
      node("recordVoice").setAttribute(
        "aria-label",
        "Réessayer l’enregistrement",
      );
      node("chooseVoice").disabled = false;
      message("L’enregistrement a été interrompu. Réessayez.", true);
      node("recordVoice").disabled = false;
    };
    recorder.start();
    node("recordVoice").disabled = false;
    startedAt = Date.now();
    node("recordVoice").classList.add("recording");
    node("recordVoice").textContent = "■";
    node("recordVoice").setAttribute("aria-label", "Arrêter l’enregistrement");
    node("recordHint").textContent =
      "Enregistrement en cours · touchez pour arrêter";
    node("submitVoice").disabled = node("chooseVoice").disabled = true;
    timer = setInterval(() => {
      const seconds = Math.floor((Date.now() - startedAt) / 1000);
      node("recordTimer").textContent =
        String(Math.floor(seconds / 60)).padStart(2, "0") +
        ":" +
        String(seconds % 60).padStart(2, "0");
      if (seconds >= 300) stopRecording();
    }, 250);
    message("");
  } catch (error) {
    stopMicrophone();
    node("recordVoice").disabled = false;
    message(
      error.name === "NotAllowedError"
        ? "Autorisez le microphone dans les réglages du navigateur, ou importez un enregistrement."
        : "Microphone indisponible. Vous pouvez utiliser l’enregistreur du téléphone.",
      true,
    );
  }
});
node("chooseVoice").addEventListener("click", () =>
  node("nativeVoice").click(),
);
node("nativeVoice").addEventListener("change", (event) => {
  if (event.target.files[0]) selectFile(event.target.files[0]);
  event.target.value = "";
});
node("submitVoice").addEventListener("click", async () => {
  if (!file || !active) return;
  node("submitVoice").disabled =
    node("recordVoice").disabled =
    node("chooseVoice").disabled =
      true;
  message("Envoi de l’audio au PC…");
  const body = new FormData();
  body.append("audio", file, file.name || "enregistrement");
  try {
    await requestAudio({ method: "POST", body });
    active = false;
    node("submitVoice").textContent = "✓ Audio envoyé au PC";
    message(
      "C’est envoyé ! Vous pouvez revenir au PC pour écouter et enregistrer la question.",
    );
    history.replaceState(null, "", location.pathname);
  } catch (error) {
    message(error.message, true);
    node("submitVoice").disabled = node("chooseVoice").disabled = false;
    node("recordVoice").disabled = !navigator.mediaDevices?.getUserMedia;
  }
});
window.addEventListener("pagehide", stopMicrophone);
(async () => {
  try {
    if (!token)
      throw new Error("Scannez le QR code audio de la question sur le PC.");
    const job = await requestAudio();
    node("recordContext").textContent =
      "SÉRIE " + job.seriesNum + " · QUESTION " + job.questionNum;
    node("recordTitle").textContent = job.label;
    node("recordCertificate").href = job.connection.certificateUrl;
    node("recordFingerprint").textContent =
      job.connection.certificateFingerprint || "";
    node("secureRecordLink").href =
      job.connection.httpsOrigin + "/record.html#token=" + token;
    if (job.state !== "pending") {
      message(
        "Cet audio a déjà été envoyé au PC. Créez un nouveau QR code pour enregistrer une autre version.",
      );
      return;
    }
    active = true;
    node("chooseVoice").disabled = false;
    const supported = Boolean(
      window.isSecureContext &&
        navigator.mediaDevices?.getUserMedia &&
        window.MediaRecorder,
    );
    node("recordVoice").disabled = !supported;
    node("secureAdvice").hidden = supported;
    node("recordHint").textContent = supported
      ? "Touchez le bouton pour enregistrer."
      : "Utilisez HTTPS ou importez un enregistrement.";
  } catch (error) {
    message(error.message, true);
    node("recordHint").textContent = "Lien indisponible";
  }
})();
