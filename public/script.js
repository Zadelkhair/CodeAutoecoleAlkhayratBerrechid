// The existing JSON schema and API routes are intentionally preserved.
let form = {};
let series = [];
let selectedSerie = {};
let selectedQuestion = {};
let currentQuestionIndex = -1;
let dirty = false;
let busy = false;
let mediaRecorder = null;
let micStream = null;
let bulkImages = [];
let toastTimer;
const byId = (id) => document.getElementById(id);

function toast(message, error = false) {
  const element = byId("studioToast");
  element.textContent = message;
  element.classList.toggle("error", error);
  element.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(
    () => {
      element.hidden = true;
    },
    error ? 7000 : 4000,
  );
}

function setDirty(value) {
  dirty = value;
  byId("saveStatus").classList.toggle("dirty", value);
  byId("saveStatus").classList.remove("error");
  byId("saveStatusText").textContent = value
    ? "Modifications non enregistrées"
    : selectedSerie.num != null
      ? "Toutes les modifications sont enregistrées"
      : "Sélectionnez une série pour commencer.";
  checkAssetsLoaded();
}
function markDirty() {
  if (selectedSerie.num != null) setDirty(true);
}
function questionLoading(value) {
  byId("question-loader").classList.toggle("d-none", !value);
}

function confirmAction(title, message, label = "Confirmer") {
  if (byId("confirmDialog").open) return Promise.resolve(false);
  byId("confirmTitle").textContent = title;
  byId("confirmMessage").textContent = message;
  byId("confirmAction").textContent = label;
  byId("confirmDialog").returnValue = "cancel";
  byId("confirmDialog").showModal();
  return new Promise((resolve) => {
    byId("confirmDialog").addEventListener(
      "close",
      () => resolve(byId("confirmDialog").returnValue === "confirm"),
      { once: true },
    );
  });
}
async function canNavigate() {
  if (busy || mediaRecorder?.state === "recording") {
    toast("Terminez l’enregistrement en cours avant de continuer.", true);
    return false;
  }
  if (!dirty) return true;
  if (
    !(await confirmAction(
      "Enregistrer avant de continuer ?",
      "Vous avez des modifications non enregistrées. Enregistrez-les pour changer de question sans les perdre.",
      "Enregistrer et continuer",
    ))
  )
    return false;
  return saveQuestion();
}

function updateImage() {
  const image = byId("s-image");
  const present = Boolean(form.img);
  image.hidden = !present;
  byId("s-image-container").classList.toggle("has-image", present);
  byId("imageStatus").textContent = present
    ? "Image prête · cliquez pour la remplacer"
    : "Aucune image sélectionnée";
  byId("remove-image-btn").disabled = !present;
}
function updateAnswers() {
  const answers = form.answer || [];
  byId("answerHint").textContent = answers.length
    ? "Réponse" + (answers.length > 1 ? "s" : "") + " : " + answers.join(", ")
    : "Choisissez les réponses correctes.";
}
function updateStats() {
  byId("totalSeries").textContent = series.length;
  byId("totalQuestions").textContent = series.reduce(
    (sum, item) => sum + item.questions.length,
    0,
  );
  byId("questionCount").textContent = selectedSerie.questions?.length || 0;
}
function renderQuestionList() {
  byId("questionList").replaceChildren();
  const query = byId("questionSearch").value.trim();
  for (const question of selectedSerie.questions || []) {
    if (query && !String(question.num).includes(query)) continue;
    const button = document.createElement("button");
    button.className = "question-tile";
    button.textContent = String(question.num).padStart(2, "0");
    button.dataset.num = question.num;
    button.setAttribute("aria-label", "Question " + question.num);
    button.title =
      !question.img || !question.answer?.length
        ? "Question " + question.num + " · À compléter"
        : "Question " + question.num;
    button.classList.toggle("selected", question.num === selectedQuestion.num);
    button.classList.toggle(
      "incomplete",
      !question.img || !question.answer?.length,
    );
    if (question.num === selectedQuestion.num)
      button.setAttribute("aria-current", "true");
    button.addEventListener("click", async () => {
      if (question.num === selectedQuestion.num || !(await canNavigate()))
        return;
      selectQuestion(question.num);
      closeSidebar();
    });
    byId("questionList").appendChild(button);
  }
  if (!byId("questionList").children.length) {
    const empty = document.createElement("span");
    empty.style.cssText =
      "grid-column:1/-1;font-size:10px;color:#868a7f;padding:10px 0";
    empty.textContent = selectedSerie.questions?.length
      ? "Aucun résultat."
      : "Ajoutez votre première question.";
    byId("questionList").appendChild(empty);
  }
  updateStats();
}
function renderSeriesSelect() {
  const select = byId("serieSelect");
  select.replaceChildren();
  const placeholder = new Option("Choisir une série", "");
  select.add(placeholder);
  for (const item of series)
    select.add(
      new Option(
        "Série " + item.num + " · " + item.questions.length + " questions",
        item.num,
      ),
    );
  select.value = selectedSerie.num ?? "";
}

function selectQuestion(num) {
  selectedQuestion =
    selectedSerie.questions?.find((item) => String(item.num) === String(num)) ||
    {};
  currentQuestionIndex =
    selectedSerie.questions?.indexOf(selectedQuestion) ?? -1;
  form = {
    serie_num: selectedSerie.num,
    question_num: selectedQuestion.num ?? null,
    img: selectedQuestion.img || null,
    audio: selectedQuestion.audio || null,
    audio_explination: selectedQuestion.audio_explination || null,
    answer: [...(selectedQuestion.answer || [])],
  };
  byId("selectedSerie-num").textContent = selectedSerie.num ?? "—";
  byId("selectedQuestion-num").textContent = selectedQuestion.num ?? "—";
  byId("editorPosition").textContent =
    currentQuestionIndex >= 0
      ? "Question " +
        (currentQuestionIndex + 1) +
        " sur " +
        selectedSerie.questions.length
      : "Aucune question sélectionnée";
  const image = byId("s-image");
  if (form.img) image.src = form.img;
  else image.removeAttribute("src");
  for (const [id, value] of [
    ["question-audio-player", form.audio],
    ["explanation-audio-player", form.audio_explination],
  ]) {
    const audio = byId(id);
    audio.pause();
    if (value) audio.src = value;
    else audio.removeAttribute("src");
    audio.load();
  }
  document.querySelectorAll("#answer-checks input").forEach((input) => {
    input.checked = form.answer.includes(input.value);
    input.disabled = form.question_num == null;
  });
  updateImage();
  updateAnswers();
  renderQuestionList();
  setDirty(false);
  byId("prev-question-btn").disabled = currentQuestionIndex <= 0;
  byId("next-question-btn").disabled =
    currentQuestionIndex < 0 ||
    currentQuestionIndex >= selectedSerie.questions.length - 1;
}
function selectSerie(num) {
  selectedSerie = series.find((item) => String(item.num) === String(num)) || {};
  byId("serieDescription").value = selectedSerie.description || "";
  byId("serieDescription").disabled = selectedSerie.num == null;
  byId("questionSearch").value = "";
  selectQuestion(selectedSerie.questions?.[0]?.num);
  renderSeriesSelect();
}

function checkAssetsLoaded() {
  byId("saveQuestion").disabled = busy || selectedSerie.num == null;
  byId("newQuestion").disabled = busy || selectedSerie.num == null;
  byId("deleteQuestion").disabled = busy || form.question_num == null;
  byId("deleteSeries").disabled = busy || selectedSerie.num == null;
  byId("generate-image-btn").disabled = busy || form.question_num == null;
  byId("s-image-container").setAttribute(
    "aria-disabled",
    String(form.question_num == null),
  );
  [
    "upload-question-audio",
    "upload-explanation-audio",
    "record-question-audio",
    "record-explanation-audio",
    "phone-question-audio",
    "phone-explanation-audio",
  ].forEach((id) => {
    byId(id).disabled = busy || form.question_num == null;
  });
  byId("bulk-image-submit").disabled =
    busy || selectedSerie.num == null || !bulkImages.length;
  byId("newSeries").disabled = busy;
  byId("serieSelect").disabled = busy;
}
function setBusy(value) {
  busy = value;
  byId("workspace").inert = value;
  byId("saveQuestion").classList.toggle("loading", value);
  checkAssetsLoaded();
}

async function saveQuestion() {
  if (busy || selectedSerie.num == null) return false;
  if (mediaRecorder?.state === "recording") {
    toast("Arrêtez l’enregistrement audio avant de sauvegarder.", true);
    return false;
  }
  setBusy(true);
  byId("saveStatusText").textContent = "Enregistrement en cours…";
  try {
    const updated = structuredClone(selectedSerie);
    updated.description = byId("serieDescription").value;
    if (form.question_num != null) {
      const question = { ...selectedQuestion, answer: [...form.answer] };
      for (const [field, resultKey] of [
        ["img", "image"],
        ["audio", "audio"],
        ["audio_explination", "audioExplanation"],
      ]) {
        const value = form[field];
        if (value && value !== selectedQuestion[field]) {
          const result = await services.uploadSeriesAssets(
            field === "img" ? value : null,
            field === "audio" ? value : null,
            field === "audio_explination" ? value : null,
          );
          question[field] = result[resultKey];
        } else question[field] = value || "";
      }
      updated.questions[currentQuestionIndex] = question;
    }
    await services.updateSeries(selectedSerie.num, updated);
    series[series.indexOf(selectedSerie)] = updated;
    selectedSerie = updated;
    selectQuestion(form.question_num);
    renderSeriesSelect();
    toast("Modifications enregistrées.");
    return true;
  } catch (error) {
    byId("saveStatus").classList.add("error");
    byId("saveStatusText").textContent =
      "Échec de l’enregistrement · réessayez";
    toast(error.message, true);
    return false;
  } finally {
    setBusy(false);
  }
}
async function createASerie() {
  if (!(await canNavigate())) return;
  const nextNum =
    Math.max(0, ...series.map((item) => Number(item.num) || 0)) + 1;
  const item = { num: nextNum, description: "", questions: [] };
  setBusy(true);
  try {
    await services.createSeries(item);
    series.push(item);
    selectSerie(nextNum);
    toast("Série " + nextNum + " créée. Ajoutez votre première question.");
  } catch (error) {
    toast(error.message, true);
  } finally {
    setBusy(false);
  }
}
async function createAQuestion() {
  if (selectedSerie.num == null || !(await canNavigate())) return;
  const updated = structuredClone(selectedSerie);
  const num =
    Math.max(
      0,
      ...updated.questions.map((question) => Number(question.num) || 0),
    ) + 1;
  updated.questions.push({
    num,
    img: "",
    audio: "",
    audio_explination: "",
    answer: [],
  });
  setBusy(true);
  try {
    await services.updateSeries(updated.num, updated);
    series[series.indexOf(selectedSerie)] = updated;
    selectedSerie = updated;
    selectQuestion(num);
    renderSeriesSelect();
    closeSidebar();
    toast("Nouvelle question ajoutée.");
  } catch (error) {
    toast(error.message, true);
  } finally {
    setBusy(false);
  }
}
async function deleteQuestion() {
  if (busy || form.question_num == null) return;
  if (
    !(await confirmAction(
      "Supprimer cette question ?",
      "La question " +
        form.question_num +
        " sera retirée de la série. Cette action ne peut pas être annulée dans le studio.",
      "Supprimer la question",
    ))
  )
    return;
  const updated = structuredClone(selectedSerie);
  updated.questions = updated.questions.filter(
    (question) => question.num !== selectedQuestion.num,
  );
  setBusy(true);
  try {
    await services.updateSeries(updated.num, updated);
    series[series.indexOf(selectedSerie)] = updated;
    selectSerie(updated.num);
    toast("Question supprimée.");
  } catch (error) {
    toast(error.message, true);
  } finally {
    setBusy(false);
  }
}
async function deleteSerie() {
  if (busy || selectedSerie.num == null) return;
  if (
    !(await confirmAction(
      "Supprimer toute la série ?",
      "La série " +
        selectedSerie.num +
        " et ses " +
        selectedSerie.questions.length +
        " questions seront supprimées. Vérifiez que vous disposez d’une sauvegarde.",
      "Supprimer la série",
    ))
  )
    return;
  setBusy(true);
  try {
    await services.deleteSeries(selectedSerie.num);
    series = series.filter((item) => item !== selectedSerie);
    selectSerie(series[0]?.num);
    toast("Série supprimée.");
  } catch (error) {
    toast(error.message, true);
  } finally {
    setBusy(false);
  }
}
async function prevQ() {
  if (currentQuestionIndex > 0 && (await canNavigate()))
    selectQuestion(selectedSerie.questions[currentQuestionIndex - 1].num);
}
async function nextQ() {
  if (
    currentQuestionIndex < (selectedSerie.questions?.length || 0) - 1 &&
    (await canNavigate())
  )
    selectQuestion(selectedSerie.questions[currentQuestionIndex + 1].num);
}

function chooseImage(file) {
  if (form.question_num == null) {
    toast("Sélectionnez ou créez une question pour ajouter une image.", true);
    return;
  }
  if (!file?.type.startsWith("image/")) return;
  form.img = URL.createObjectURL(file);
  byId("s-image").src = form.img;
  updateImage();
  markDirty();
}
byId("s-image-container").addEventListener("click", () => {
  if (form.question_num != null) byId("imageFile").click();
});
byId("s-image-container").addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    byId("s-image-container").click();
  }
});
byId("imageFile").addEventListener("change", (event) => {
  chooseImage(event.target.files[0]);
  event.target.value = "";
});
byId("s-image-container").addEventListener("dragover", (event) =>
  event.preventDefault(),
);
byId("s-image-container").addEventListener("drop", (event) => {
  event.preventDefault();
  chooseImage(event.dataTransfer.files[0]);
});
byId("s-image").addEventListener("load", updateImage);
byId("remove-image-btn").addEventListener("click", () => {
  form.img = null;
  byId("s-image").removeAttribute("src");
  updateImage();
  markDirty();
});
document.querySelectorAll("#answer-checks input").forEach((input) =>
  input.addEventListener("change", () => {
    form.answer = [
      ...document.querySelectorAll("#answer-checks input:checked"),
    ].map((item) => item.value);
    updateAnswers();
    markDirty();
  }),
);
byId("serieDescription").addEventListener("input", markDirty);
byId("questionSearch").addEventListener("input", renderQuestionList);
byId("serieSelect").addEventListener("change", async (event) => {
  const num = event.target.value;
  if (await canNavigate()) selectSerie(num);
  else event.target.value = selectedSerie.num ?? "";
});
byId("newSeries").addEventListener("click", createASerie);
byId("newQuestion").addEventListener("click", createAQuestion);
byId("saveQuestion").addEventListener("click", saveQuestion);
byId("deleteQuestion").addEventListener("click", deleteQuestion);
byId("deleteSeries").addEventListener("click", deleteSerie);

for (const [uploadId, inputId, playerId, field, recordId] of [
  [
    "upload-question-audio",
    "audioFile1",
    "question-audio-player",
    "audio",
    "record-question-audio",
  ],
  [
    "upload-explanation-audio",
    "audioFile2",
    "explanation-audio-player",
    "audio_explination",
    "record-explanation-audio",
  ],
]) {
  byId(uploadId).addEventListener("click", () => byId(inputId).click());
  byId(inputId).addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) return;
    form[field] = URL.createObjectURL(file);
    byId(playerId).src = form[field];
    event.target.value = "";
    markDirty();
  });
  byId(recordId).addEventListener("click", async () => {
    const button = byId(recordId);
    if (button.classList.contains("recording")) {
      mediaRecorder.stop();
      return;
    }
    if (mediaRecorder?.state === "recording") {
      toast("Arrêtez d’abord l’autre enregistrement.", true);
      return;
    }
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error(
          "Le microphone nécessite localhost ou une connexion HTTPS.",
        );
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks = [];
      mediaRecorder = new MediaRecorder(micStream);
      const activeRecorder = mediaRecorder;
      activeRecorder.ondataavailable = (event) => chunks.push(event.data);
      activeRecorder.onstop = () => {
        const blob = new Blob(chunks, {
          type: activeRecorder.mimeType || "audio/webm",
        });
        form[field] = URL.createObjectURL(blob);
        byId(playerId).src = form[field];
        micStream.getTracks().forEach((track) => track.stop());
        button.classList.remove("recording");
        button.querySelector("span").textContent = "Enregistrer";
        markDirty();
      };
      activeRecorder.start();
      button.classList.add("recording");
      button.querySelector("span").textContent = "Arrêter";
    } catch (error) {
      micStream?.getTracks().forEach((track) => track.stop());
      toast(error.message || "Impossible d’accéder au microphone.", true);
    }
  });
}
function handleBulkFiles(files) {
  bulkImages = [...files].filter((file) => file.type.startsWith("image/"));
  byId("bulk-image-preview").replaceChildren();
  for (const file of bulkImages) {
    const image = document.createElement("img");
    image.src = URL.createObjectURL(file);
    image.alt = file.name;
    byId("bulk-image-preview").appendChild(image);
  }
  byId("bulk-image-drop-text").textContent = bulkImages.length
    ? bulkImages.length + " images sélectionnées"
    : "Déposer ou choisir des images";
  checkAssetsLoaded();
}
byId("bulk-image-drop").addEventListener("click", () =>
  byId("bulk-image-input").click(),
);
byId("bulk-image-input").addEventListener("change", (event) =>
  handleBulkFiles(event.target.files),
);
byId("bulk-image-drop").addEventListener("dragover", (event) => {
  event.preventDefault();
  event.currentTarget.classList.add("dragover");
});
byId("bulk-image-drop").addEventListener("dragleave", (event) =>
  event.currentTarget.classList.remove("dragover"),
);
byId("bulk-image-drop").addEventListener("drop", (event) => {
  event.preventDefault();
  event.currentTarget.classList.remove("dragover");
  handleBulkFiles(event.dataTransfer.files);
});
byId("bulk-image-submit").addEventListener("click", async () => {
  if (!bulkImages.length || selectedSerie.num == null || !(await canNavigate()))
    return;
  const updated = structuredClone(selectedSerie);
  let num =
    Math.max(0, ...updated.questions.map((item) => Number(item.num) || 0)) + 1;
  setBusy(true);
  try {
    for (let index = 0; index < bulkImages.length; index++) {
      byId("bulk-image-submit").textContent =
        "Import " + (index + 1) + " / " + bulkImages.length;
      const output = await services.uploadSeriesAssets(
        bulkImages[index],
        null,
        null,
      );
      updated.questions.push({
        num: num++,
        img: output.image,
        audio: "",
        audio_explination: "",
        answer: [],
      });
    }
    await services.updateSeries(updated.num, updated);
    series[series.indexOf(selectedSerie)] = updated;
    selectSerie(updated.num);
    handleBulkFiles([]);
    toast("Images importées. Les nouvelles questions sont prêtes à compléter.");
  } catch (error) {
    toast(error.message, true);
  } finally {
    byId("bulk-image-submit").textContent = "Importer les images";
    setBusy(false);
  }
});

async function publish(kind) {
  if (busy) return;
  if (dirty && !(await canNavigate())) return;
  if (
    kind === "push" &&
    !(await confirmAction(
      "Publier sur GitHub ?",
      "Les questions et les médias seront synchronisés puis envoyés sur GitHub. Les autres fichiers, les clés et les réglages privés ne sont pas inclus.",
      "Publier sur GitHub",
    ))
  )
    return;
  byId("syncDocs").disabled = byId("publishGithub").disabled = true;
  setBusy(true);
  byId("publishStatus").textContent =
    kind === "sync" ? "Synchronisation en cours…" : "Publication en cours…";
  try {
    if (kind === "sync") await services.syncToDocs();
    else await services.pushToGithub();
    byId("publishStatus").textContent =
      kind === "sync"
        ? "Données synchronisées. Vous pouvez publier."
        : "Modifications envoyées à GitHub.";
    toast(
      kind === "sync"
        ? "Le contenu du site est synchronisé."
        : "Modifications envoyées à GitHub.",
    );
  } catch (error) {
    byId("publishStatus").textContent = "Action non terminée. Réessayez.";
    toast(error.message, true);
  } finally {
    byId("syncDocs").disabled = byId("publishGithub").disabled = false;
    setBusy(false);
  }
}
byId("syncDocs").addEventListener("click", () => publish("sync"));
byId("publishGithub").addEventListener("click", () => publish("push"));
function closeSidebar() {
  byId("sidebar").classList.remove("open");
  byId("sidebarBackdrop").hidden = true;
  byId("sidebarToggle").setAttribute("aria-expanded", "false");
}
byId("sidebarToggle").addEventListener("click", () => {
  const open = byId("sidebar").classList.toggle("open");
  byId("sidebarBackdrop").hidden = !open;
  byId("sidebarToggle").setAttribute("aria-expanded", String(open));
});
byId("sidebarBackdrop").addEventListener("click", closeSidebar);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeSidebar();
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    if (!busy) saveQuestion();
  }
});
window.addEventListener("beforeunload", (event) => {
  if (dirty || mediaRecorder?.state === "recording") {
    event.preventDefault();
    event.returnValue = "";
  }
});
async function start() {
  questionLoading(true);
  setBusy(true);
  try {
    series = await services.getSeries();
    selectSerie(series[0]?.num);
  } catch (error) {
    byId("serieSelect").replaceChildren(
      new Option("Chargement impossible", ""),
    );
    toast(error.message, true);
  } finally {
    questionLoading(false);
    setBusy(false);
  }
}
start();
