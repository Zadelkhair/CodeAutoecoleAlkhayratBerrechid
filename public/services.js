async function apiRequest(url, options = {}) {
  let response;
  try {
    response = await fetch(url, options);
  } catch {
    throw new Error(
      "Connexion au serveur interrompue. Vérifiez que le studio est démarré.",
    );
  }
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }
  if (!response.ok)
    throw new Error(
      data.message ||
        data.error ||
        "L’action a échoué. Réessayez dans un instant.",
    );
  return data;
}
const services = {
  getSeries: () => apiRequest("/series"),
  getSeriesByNumber: (num) => apiRequest("/series/" + num),
  updateSeries: (num, updatedData) =>
    apiRequest("/series/" + num, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedData),
    }),
  createSeries: (newSeries) =>
    apiRequest("/series", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newSeries),
    }),
  deleteSeries: (num) => apiRequest("/series/" + num, { method: "DELETE" }),
  syncToDocs: () => apiRequest("/sync-to-docs", { method: "POST" }),
  pushToGithub: () => apiRequest("/push-to-github", { method: "POST" }),
  uploadSeriesAssets: async (image, audio, explanation) => {
    const data = new FormData();
    for (const [name, source] of [
      ["image", image],
      ["audio", audio],
      ["audioExplanation", explanation],
    ]) {
      if (!source) continue;
      if (source instanceof File) {
        data.append(name, source);
        continue;
      }
      let blob = source;
      if (!(blob instanceof Blob)) {
        const response = await fetch(source);
        if (!response.ok)
          throw new Error("Impossible de lire le fichier à importer.");
        blob = await response.blob();
      }
      const extensions = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "audio/mpeg": "mp3",
        "audio/mp4": "m4a",
        "audio/ogg": "ogg",
      };
      const extension =
        extensions[blob.type.split(";")[0]] ||
        (name === "image" ? "png" : "webm");
      data.append(name, blob, name + "." + extension);
    }
    return apiRequest("/question/assets/upload", {
      method: "POST",
      body: data,
    });
  },
};
