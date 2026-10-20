const express = require("express");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const http = require("node:http");
const https = require("node:https");
const fileUpload = require("express-fileupload");
const {
  createAccess,
  createTLS,
  networkAddresses,
  requestSafety,
  privateAddress,
  loopback,
} = require("./studio/network");
const { createMobile, audioExtension } = require("./studio/mobile");
const { createPublication } = require("./studio/publication");

const ROOT = __dirname;
require("dotenv").config({ path: path.join(ROOT, ".env") });

function createApp(options = {}) {
  const root = options.root || ROOT;
  const app = express();
  const access = createAccess();
  const wrap = (action) => (req, res, next) =>
    Promise.resolve(action(req, res, next)).catch(next);
  const dbPath = path.join(root, "db.json");
  const readDatabase = () => JSON.parse(fs.readFileSync(dbPath, "utf8"));
  const writeDatabase = (data) => {
    const temporary = path.join(
      root,
      ".studio",
      "database-" + crypto.randomUUID() + ".tmp",
    );
    fs.mkdirSync(path.dirname(temporary), { recursive: true });
    fs.writeFileSync(temporary, JSON.stringify(data, null, 2));
    fs.renameSync(temporary, dbPath);
  };
  const sync = () =>
    fs.writeFileSync(
      path.join(root, "docs", "db.js"),
      "let database = " + JSON.stringify(readDatabase()) + ";",
    );
  const publication = createPublication({
    root,
    sync,
    ...(options.gitFactory ? { gitFactory: options.gitFactory } : {}),
  });
  function connectionInfo(req, requestedAddress) {
    const addresses = networkAddresses().sort(
      (a, b) =>
        Number(!a.address.startsWith("192.168.")) -
        Number(!b.address.startsWith("192.168.")),
    );
    const selected = requestedAddress
      ? addresses.find((item) => item.address === requestedAddress)
      : addresses[0];
    if (requestedAddress && !selected)
      throw Object.assign(
        new Error(
          "Cette adresse réseau n’est plus disponible. Actualisez le QR code.",
        ),
        { status: 400 },
      );
    const ip = selected?.address || "127.0.0.1";
    const httpPort = req.secure ? options.port || 5080 : req.socket.localPort;
    const httpsPort = req.secure
      ? req.socket.localPort
      : options.httpsPort || 5443;
    const httpOrigin = "http://" + ip + ":" + httpPort;
    const httpsOrigin = "https://" + ip + ":" + httpsPort;
    return {
      addresses,
      address: ip,
      httpOrigin,
      httpsOrigin,
      certificateUrl: httpOrigin + "/studio-certificate.crt",
      certificateFingerprint: options.tls?.fingerprint || null,
    };
  }

  app.disable("x-powered-by");
  app.use(requestSafety);
  app.use(express.json({ limit: "1mb" }));
  app.use(
    fileUpload({
      limits: { fileSize: 25 * 1024 * 1024, files: 3 },
      abortOnLimit: true,
      responseOnLimit: "Le fichier dépasse la limite de 25 Mo.",
    }),
  );
  app.get("/api/health", (req, res) =>
    res.json({ ok: true, service: "Code Alkhayrat Studio" }),
  );
  app.get("/api/connection", access.requireAdmin, (req, res) =>
    res.json(connectionInfo(req)),
  );
  app.get("/studio-certificate.crt", (req, res) => {
    if (
      !options.tls ||
      (!loopback(req.socket.remoteAddress) &&
        !privateAddress(req.socket.remoteAddress))
    )
      return res.sendStatus(404);
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="Code-Alkhayrat-Studio-CA.crt"',
    );
    res.type("application/x-x509-ca-cert").send(options.tls.ca);
  });

  const mobile = createMobile({
    root,
    access,
    connectionInfo,
    readDatabase,
    wrap,
  });
  mobile.routes(app);

  app.get("/series", access.requireAdmin, (req, res) =>
    res.json(readDatabase().series),
  );
  app.get("/series/:num", access.requireAdmin, (req, res) => {
    const serie = readDatabase().series.find(
      (item) => Number(item.num) === Number(req.params.num),
    );
    if (!serie) return res.status(404).json({ message: "Série introuvable." });
    res.json(serie);
  });
  app.put("/series/:num", access.requireAdmin, (req, res) => {
    const db = readDatabase();
    const index = db.series.findIndex(
      (item) => Number(item.num) === Number(req.params.num),
    );
    if (index < 0)
      return res.status(404).json({ message: "Série introuvable." });
    if (!Array.isArray(req.body.questions))
      return res
        .status(400)
        .json({ message: "La liste des questions est invalide." });
    db.series[index] = {
      ...db.series[index],
      ...req.body,
      num: db.series[index].num,
    };
    writeDatabase(db);
    res.json({ message: "Série enregistrée.", series: db.series[index] });
  });
  app.post("/series", access.requireAdmin, (req, res) => {
    const db = readDatabase();
    const num = Number(req.body.num);
    if (
      !Number.isSafeInteger(num) ||
      num < 1 ||
      !Array.isArray(req.body.questions)
    )
      return res
        .status(400)
        .json({ message: "Numéro de série ou questions non valides." });
    if (db.series.some((item) => Number(item.num) === num))
      return res
        .status(409)
        .json({ message: "Ce numéro de série existe déjà." });
    const serie = {
      num,
      description: String(req.body.description || ""),
      questions: req.body.questions,
    };
    db.series.push(serie);
    writeDatabase(db);
    res.status(201).json({ message: "Série créée.", series: serie });
  });
  app.delete("/series/:num", access.requireAdmin, (req, res) => {
    const db = readDatabase();
    const index = db.series.findIndex(
      (item) => Number(item.num) === Number(req.params.num),
    );
    if (index < 0)
      return res.status(404).json({ message: "Série introuvable." });
    db.series.splice(index, 1);
    writeDatabase(db);
    res.json({ message: "Série supprimée." });
  });
  app.post(
    "/question/assets/upload",
    access.requireAdmin,
    wrap(async (req, res) => {
      const fields = [
        ["image", "image"],
        ["audio", "audio"],
        ["audioExplanation", "audioExplanation"],
      ];
      if (!fields.some(([field]) => req.files?.[field]))
        return res.status(400).json({ message: "Aucun fichier sélectionné." });
      const uploads = [];
      for (const [field, key] of fields) {
        const file = req.files?.[field];
        if (!file) continue;
        if (Array.isArray(file) || file.truncated)
          return res
            .status(400)
            .json({ message: "Un seul fichier par champ, de moins de 25 Mo." });
        const extension =
          field === "image"
            ? {
                "image/png": "png",
                "image/jpeg": "jpg",
                "image/webp": "webp",
                "image/gif": "gif",
                "image/avif": "avif",
              }[file.mimetype]
            : audioExtension(file.data);
        if (!extension)
          return res
            .status(415)
            .json({ message: "Format de fichier non pris en charge." });
        uploads.push({
          file,
          key,
          name: Date.now() + "_" + crypto.randomUUID() + "." + extension,
        });
      }
      const directory = path.join(root, "docs", "assets", "new_series");
      fs.mkdirSync(directory, { recursive: true });
      await Promise.all(
        uploads.map((upload) =>
          upload.file.mv(path.join(directory, upload.name)),
        ),
      );
      const result = { image: null, audio: null, audioExplanation: null };
      for (const upload of uploads)
        result[upload.key] = "assets/new_series/" + upload.name;
      res.status(201).json(result);
    }),
  );
  app.post("/sync-to-docs", access.requireAdmin, (req, res) => {
    sync();
    res.json({ message: "Le contenu du site est synchronisé." });
  });
  app.get(
    "/api/git/status",
    access.requireAdmin,
    wrap(async (req, res) => res.json(await publication.status())),
  );
  app.post(
    "/api/git/verify",
    access.requireAdmin,
    wrap(async (req, res) => {
      try {
        res.json(await publication.verify());
      } catch {
        res
          .status(502)
          .json({
            message:
              "Ce PC n’a pas pu confirmer son accès GitHub. Vérifiez la connexion et la clé de déploiement autorisée pour ce dépôt.",
          });
      }
    }),
  );
  app.post(
    "/push-to-github",
    access.requireAdmin,
    wrap(async (req, res) => res.json(await publication.publish())),
  );

  app.get("/", (req, res, next) => {
    if (!access.session(req))
      return res.status(401).sendFile(path.join(root, "public", "access.html"));
    next();
  });
  app.use(
    express.static(path.join(root, "public"), { etag: false, maxAge: 0 }),
  );
  app.use("/preview", express.static(path.join(root, "docs")));
  app.use("/assets", express.static(path.join(root, "docs", "assets")));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    console.error("Studio:", error.code || error.status || error.name);
    res
      .status(error.status || 500)
      .json({
        message: error.status
          ? error.message
          : "L’action n’a pas pu être terminée. Vos données enregistrées sont conservées.",
      });
  });
  app.locals.close = mobile.close;
  return app;
}

function start() {
  const port = Number(process.env.PORT || 5080);
  const httpsPort = Number(process.env.HTTPS_PORT || 5443);
  const tls = createTLS(ROOT);
  const app = createApp({ root: ROOT, port, httpsPort, tls });
  const httpServer = http
    .createServer(app)
    .listen(port, "0.0.0.0", () =>
      console.log("Studio : http://localhost:" + port),
    );
  const httpsServer = https
    .createServer({ key: tls.key, cert: tls.cert }, app)
    .listen(httpsPort, "0.0.0.0", () =>
      console.log("Téléphone / microphone : https://localhost:" + httpsPort),
    );
  const shutdown = () => {
    app.locals.close();
    httpServer.close();
    httpsServer.close();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  return { app, httpServer, httpsServer };
}
if (require.main === module) start();
module.exports = { createApp, start };
