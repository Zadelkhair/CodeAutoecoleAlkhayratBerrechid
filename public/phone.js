let phoneTransfer = null;
let phonePoll;
let phonePollBusy = false;
let phoneDialogVersion = 0;

function resetPhoneDialog(title, description) {
  clearInterval(phonePoll);
  byId("phoneTitle").textContent = title;
  byId("phoneDescription").textContent = description;
  byId("phoneQr").hidden = true;
  byId("phoneQrLoading").hidden = false;
  byId("phoneQrLoading").textContent = "Préparation du QR code…";
  byId("phoneTransferStatus").textContent = "Création d’un lien temporaire…";
  byId("phoneCertificateHelp").hidden = true;
  byId("phoneLink").hidden = true;
  byId("copyPhoneLink").hidden = true;
  byId("phoneDialog").showModal();
  return ++phoneDialogVersion;
}
function showPhoneCode(result, voice = false) {
  byId("phoneQr").src = result.qr;
  byId("phoneQr").hidden = false;
  byId("phoneQrLoading").hidden = true;
  byId("phoneLink").href = result.url;
  byId("phoneLink").hidden = false;
  byId("copyPhoneLink").hidden = false;
  byId("phoneTransferStatus").textContent = voice
    ? "En attente de l’envoi depuis le téléphone · lien valable 15 min"
    : "Scannez pour autoriser ce téléphone · lien à usage unique, valable 2 min";
  if (voice) {
    byId("phoneCertificateHelp").hidden = false;
    byId("phoneCertificateLink").href = result.connection.certificateUrl;
    byId("phoneCertificateFingerprint").textContent =
      result.connection.certificateFingerprint ||
      "Disponible dans l’installation Windows.";
    byId("phoneFallbackLink").href = result.fallbackUrl;
  }
}
byId("openPhone").addEventListener("click", async () => {
  const version = resetPhoneDialog(
    "Le studio, sur votre téléphone.",
    "Scannez ce QR code pour accéder aux séries, aux questions et à la publication GitHub sur votre réseau local.",
  );
  try {
    const result = await apiRequest("/api/pairing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (version === phoneDialogVersion) showPhoneCode(result);
  } catch (error) {
    if (version !== phoneDialogVersion) return;
    byId("phoneQrLoading").textContent = "Connexion indisponible";
    byId("phoneTransferStatus").textContent = error.message;
  }
});
async function createPhoneAudio(field) {
  if (busy || form.question_num == null) return;
  if (mediaRecorder?.state === "recording") {
    toast(
      "Arrêtez l’enregistrement sur le PC avant de connecter le téléphone.",
      true,
    );
    return;
  }
  const context = {
    seriesNum: selectedSerie.num,
    questionNum: selectedQuestion.num,
    field,
  };
  const version = resetPhoneDialog(
    field === "audio"
      ? "Enregistrer la question sur téléphone"
      : "Enregistrer l’explication sur téléphone",
    `Série ${context.seriesNum} · Question ${context.questionNum}. Enregistrez, écoutez puis envoyez l’audio : il apparaîtra ici sans changer de question.`,
  );
  try {
    const result = await apiRequest("/api/mobile-recordings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(context),
    });
    if (version !== phoneDialogVersion || !byId("phoneDialog").open) {
      await apiRequest("/api/mobile-recordings/" + result.id, {
        method: "DELETE",
      });
      return;
    }
    phoneTransfer = { ...context, id: result.id, expiresAt: result.expiresAt };
    showPhoneCode(result, true);
    phonePoll = setInterval(receivePhoneAudio, 1500);
  } catch (error) {
    if (version !== phoneDialogVersion) return;
    byId("phoneQrLoading").textContent = "Connexion indisponible";
    byId("phoneTransferStatus").textContent = error.message;
  }
}
async function receivePhoneAudio() {
  if (!phoneTransfer || phonePollBusy) return;
  const transfer = phoneTransfer;
  phonePollBusy = true;
  try {
    const state = await apiRequest("/api/mobile-recordings/" + transfer.id);
    if (state.state !== "ready" || phoneTransfer !== transfer) return;
    if (
      String(selectedSerie.num) !== String(transfer.seriesNum) ||
      String(selectedQuestion.num) !== String(transfer.questionNum)
    ) {
      clearInterval(phonePoll);
      byId("phoneTransferStatus").textContent =
        "Audio reçu. Revenez à la question d’origine avant de le récupérer pour éviter de l’associer à une autre question.";
      return;
    }
    const response = await fetch(
      "/api/mobile-recordings/" + transfer.id + "/audio",
    );
    if (!response.ok)
      throw new Error(
        "Impossible de récupérer l’audio. Une nouvelle tentative va être effectuée.",
      );
    const blob = await response.blob();
    if (phoneTransfer !== transfer) return;
    form[transfer.field] = URL.createObjectURL(blob);
    byId(
      transfer.field === "audio"
        ? "question-audio-player"
        : "explanation-audio-player",
    ).src = form[transfer.field];
    markDirty();
    clearInterval(phonePoll);
    phoneTransfer = null;
    byId("phoneDialog").close();
    await apiRequest("/api/mobile-recordings/" + transfer.id + "/received", {
      method: "POST",
    }).catch(() => {});
    toast("Audio reçu du téléphone. Écoutez-le, puis cliquez sur Enregistrer.");
  } catch (error) {
    byId("phoneTransferStatus").textContent =
      Date.now() > transfer.expiresAt
        ? "Ce lien a expiré. Fermez cette fenêtre et créez un nouveau QR code."
        : error.message;
    if (Date.now() > transfer.expiresAt) clearInterval(phonePoll);
  } finally {
    phonePollBusy = false;
  }
}
byId("phone-question-audio").addEventListener("click", () =>
  createPhoneAudio("audio"),
);
byId("phone-explanation-audio").addEventListener("click", () =>
  createPhoneAudio("audio_explination"),
);
byId("closePhoneDialog").addEventListener("click", () =>
  byId("phoneDialog").close(),
);
byId("phoneDialog").addEventListener("close", () => {
  phoneDialogVersion++;
  clearInterval(phonePoll);
  const canceled = phoneTransfer;
  phoneTransfer = null;
  if (canceled)
    apiRequest("/api/mobile-recordings/" + canceled.id, {
      method: "DELETE",
    }).catch(() => {});
});
byId("copyPhoneLink").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(byId("phoneLink").href);
    toast("Lien copié.");
  } catch {
    toast("Ouvrez le lien ou scannez le QR code depuis le téléphone.", true);
  }
});
byId("verifyGithub").addEventListener("click", async () => {
  const button = byId("verifyGithub");
  button.disabled = true;
  byId("publishStatus").textContent = "Vérification de l’accès GitHub…";
  try {
    const result = await apiRequest("/api/git/verify", { method: "POST" });
    byId("publishStatus").textContent = result.message;
    toast(result.message);
  } catch (error) {
    byId("publishStatus").textContent = error.message;
    toast(error.message, true);
  } finally {
    button.disabled = false;
  }
});
