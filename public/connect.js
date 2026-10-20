(async () => {
  const token = new URLSearchParams(location.hash.slice(1)).get("token");
  const message = document.getElementById("connectionMessage");
  try {
    if (!token)
      throw new Error(
        "Scannez le QR code « Ouvrir sur téléphone » affiché sur le PC.",
      );
    const response = await fetch("/api/pairing/consume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Connexion refusée.");
    history.replaceState(null, "", location.pathname);
    message.textContent = "Téléphone autorisé. Ouverture du studio…";
    location.replace("/");
  } catch (error) {
    message.textContent = error.message;
    message.classList.add("error");
  }
})();
