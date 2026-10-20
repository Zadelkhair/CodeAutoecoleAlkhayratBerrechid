const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const QRCode = require("qrcode");
const { digest, randomToken, privateAddress, loopback } = require("./network");

function audioExtension(data) {
  if (data.length < 12) return null;
  if (data.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])))
    return "webm";
  if (data.toString("ascii", 4, 8) === "ftyp") return "m4a";
  if (data.toString("ascii", 0, 4) === "OggS") return "ogg";
  if (
    data.toString("ascii", 0, 4) === "RIFF" &&
    data.toString("ascii", 8, 12) === "WAVE"
  )
    return "wav";
  if (
    data.toString("ascii", 0, 3) === "ID3" ||
    (data[0] === 0xff && (data[1] & 0xe0) === 0xe0)
  )
    return "mp3";
  return null;
}

function createMobile({ root, access, connectionInfo, readDatabase, wrap }) {
  const jobs = new Map();
  const tokens = new Map();
  const directory = path.join(root, ".studio", "transfers");
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  function removeFile(job) {
    if (job.file && path.dirname(job.file) === directory) {
      try {
        fs.unlinkSync(job.file);
      } catch (error) {
        if (error.code !== "ENOENT")
          console.error("Nettoyage audio impossible:", error.code);
      }
      job.file = null;
    }
  }
  function cleanup() {
    for (const [id, job] of jobs)
      if (job.expiresAt <= Date.now()) {
        removeFile(job);
        tokens.delete(job.hash);
        jobs.delete(id);
      }
  }
  const cleanupTimer = setInterval(cleanup, 60000);
  cleanupTimer.unref();
  function phoneJob(req, res, next) {
    cleanup();
    if (
      !loopback(req.socket.remoteAddress) &&
      !privateAddress(req.socket.remoteAddress)
    )
      return res
        .status(403)
        .json({ message: "Le téléphone doit être sur le réseau local." });
    const token = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(
      req.headers.authorization || "",
    )?.[1];
    const job = jobs.get(tokens.get(digest(token || "")));
    if (!job)
      return res
        .status(410)
        .json({
          message:
            "Ce lien a expiré ou a été annulé. Scannez un nouveau QR code sur le PC.",
        });
    req.audioJob = job;
    next();
  }
  function desktopJob(req, res, next) {
    cleanup();
    const job = jobs.get(req.params.id);
    if (
      !job ||
      (job.owner !== req.studioSession.id && !req.studioSession.local)
    )
      return res
        .status(404)
        .json({ message: "Transfert introuvable ou expiré." });
    req.audioJob = job;
    next();
  }
  const info = (job) => ({
    id: job.id,
    seriesNum: job.seriesNum,
    questionNum: job.questionNum,
    field: job.field,
    label: job.field === "audio" ? "Question audio" : "Explication audio",
    state: job.state,
    expiresAt: job.expiresAt,
  });

  function routes(app) {
    app.post(
      "/api/pairing",
      access.requireAdmin,
      wrap(async (req, res) => {
        const connection = connectionInfo(req, req.body.address);
        const pairing = access.createPairing(req.studioSession.id);
        const url = `${connection.httpOrigin}/connect.html#token=${pairing.token}`;
        res.json({
          url,
          expiresAt: pairing.expiresAt,
          qr: await QRCode.toDataURL(url, { width: 300, margin: 2 }),
          connection,
        });
      }),
    );
    app.post("/api/pairing/consume", access.consumePairing);
    app.post(
      "/api/mobile-recordings",
      access.requireAdmin,
      wrap(async (req, res) => {
        cleanup();
        const seriesNum = Number(req.body.seriesNum);
        const questionNum = Number(req.body.questionNum);
        const field = req.body.field;
        if (!["audio", "audio_explination"].includes(field))
          return res.status(400).json({ message: "Champ audio non valide." });
        if (
          !readDatabase().series.some(
            (serie) =>
              Number(serie.num) === seriesNum &&
              serie.questions.some(
                (question) => Number(question.num) === questionNum,
              ),
          )
        )
          return res
            .status(404)
            .json({
              message:
                "Sélectionnez une question existante avant de créer le QR code.",
            });
        if (jobs.size >= 100)
          return res
            .status(429)
            .json({
              message:
                "Trop de transferts en attente. Annulez les liens inutilisés.",
            });
        const connection = connectionInfo(req, req.body.address);
        const token = randomToken();
        const job = {
          id: crypto.randomUUID(),
          hash: digest(token),
          owner: req.studioSession.id,
          seriesNum,
          questionNum,
          field,
          state: "pending",
          expiresAt: Date.now() + 15 * 60 * 1000,
          connection,
        };
        jobs.set(job.id, job);
        tokens.set(job.hash, job.id);
        const url = `${connection.httpsOrigin}/record.html#token=${token}`;
        const fallbackUrl = `${connection.httpOrigin}/record.html#token=${token}`;
        res.json({
          ...info(job),
          url,
          fallbackUrl,
          qr: await QRCode.toDataURL(url, { width: 300, margin: 2 }),
          connection,
        });
      }),
    );
    app.get("/api/phone-audio", phoneJob, (req, res) =>
      res.json({ ...info(req.audioJob), connection: req.audioJob.connection }),
    );
    app.post(
      "/api/phone-audio",
      phoneJob,
      wrap(async (req, res) => {
        const job = req.audioJob;
        if (job.state !== "pending")
          return res
            .status(409)
            .json({
              message:
                "Cet enregistrement a déjà été envoyé. Créez un nouveau lien pour le remplacer.",
            });
        const file = req.files?.audio;
        if (
          !file ||
          Array.isArray(file) ||
          file.truncated ||
          file.size > 25 * 1024 * 1024
        )
          return res
            .status(400)
            .json({
              message: "Choisissez un fichier audio de moins de 25 Mo.",
            });
        const extension = audioExtension(file.data);
        if (!extension)
          return res
            .status(415)
            .json({
              message:
                "Format audio non reconnu. Utilisez un fichier M4A, MP3, WebM, OGG ou WAV.",
            });
        job.state = "uploading";
        const filename = path.join(directory, `${job.id}.${extension}`);
        try {
          await fs.promises.writeFile(filename, file.data, {
            flag: "wx",
            mode: 0o600,
          });
          job.file = filename;
          job.type = {
            m4a: "audio/mp4",
            mp3: "audio/mpeg",
            webm: "audio/webm",
            ogg: "audio/ogg",
            wav: "audio/wav",
          }[extension];
          job.state = "ready";
          res
            .status(201)
            .json({
              ok: true,
              message: "Audio envoyé. Il va apparaître sur le PC.",
            });
        } catch (error) {
          job.state = "pending";
          throw error;
        }
      }),
    );
    app.get(
      "/api/mobile-recordings/:id",
      access.requireAdmin,
      desktopJob,
      (req, res) => res.json(info(req.audioJob)),
    );
    app.get(
      "/api/mobile-recordings/:id/audio",
      access.requireAdmin,
      desktopJob,
      (req, res) => {
        const job = req.audioJob;
        if (job.state !== "ready" || !job.file)
          return res
            .status(409)
            .json({ message: "L’audio n’est pas encore disponible." });
        res.type(job.type).sendFile(job.file);
      },
    );
    app.post(
      "/api/mobile-recordings/:id/received",
      access.requireAdmin,
      desktopJob,
      (req, res) => {
        const job = req.audioJob;
        if (job.state !== "ready")
          return res
            .status(409)
            .json({ message: "Ce transfert n’est pas prêt." });
        removeFile(job);
        job.state = "received";
        res.json({ ok: true });
      },
    );
    app.delete(
      "/api/mobile-recordings/:id",
      access.requireAdmin,
      desktopJob,
      (req, res) => {
        removeFile(req.audioJob);
        tokens.delete(req.audioJob.hash);
        jobs.delete(req.audioJob.id);
        res.json({ ok: true });
      },
    );
  }
  return {
    routes,
    close: () => {
      clearInterval(cleanupTimer);
      for (const job of jobs.values()) removeFile(job);
    },
  };
}

module.exports = { createMobile, audioExtension };
